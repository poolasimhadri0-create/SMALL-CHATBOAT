const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.__BACKEND_URL__) ||
  (import.meta.env.DEV ? 'http://localhost:5000' : '');

/**
 * Parses and streams Server-Sent Events (SSE) from the FastAPI backend.
 * Events handled: "token", "sources", "done", "error"
 */
export async function streamChat({
  message,
  conversationId,
  imageFile,
  signal,
  onToken,
  onSources,
  onDone,
  onError,
}) {
  const formData = new FormData();
  formData.append('message', message);
  if (conversationId) {
    formData.append('conversation_id', conversationId);
  }
  if (imageFile) {
    formData.append('image', imageFile);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      let errMsg = `Server returned ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.error?.message) {
          errMsg = errorJson.error.message;
        }
      } catch {
        // fallback to statusText
      }
      throw new Error(errMsg);
    }

    await parseSSEStream(response.body, { onToken, onSources, onDone, onError });
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone?.({ cancelled: true });
    } else {
      onError?.(err);
    }
  }
}

/**
 * Regenerates the last answer in a conversation.
 */
export async function streamRegenerate({
  conversationId,
  signal,
  onToken,
  onSources,
  onDone,
  onError,
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/${conversationId}/regenerate`, {
      method: 'POST',
      signal,
    });

    if (!response.ok) {
      let errMsg = `Regeneration failed: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.error?.message) errMsg = errorJson.error.message;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }

    await parseSSEStream(response.body, { onToken, onSources, onDone, onError });
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone?.({ cancelled: true });
    } else {
      onError?.(err);
    }
  }
}

async function parseSSEStream(stream, { onToken, onSources, onDone, onError }) {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep partial line for next iteration

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('event:')) {
        currentEvent = line.replace('event:', '').trim();
      } else if (line.startsWith('data:')) {
        const dataStr = line.replace('data:', '').trim();
        try {
          const payload = JSON.parse(dataStr);
          if (currentEvent === 'token' && payload.token) {
            onToken?.(payload.token);
          } else if (currentEvent === 'sources' && payload.sources) {
            onSources?.(payload.sources);
          } else if (currentEvent === 'done') {
            onDone?.(payload);
          } else if (currentEvent === 'error') {
            onError?.(new Error(payload.error || 'Unknown streaming error'));
          }
        } catch {
          // If non-JSON string
          if (currentEvent === 'token') {
            onToken?.(dataStr);
          }
        }
      }
    }
  }
}
