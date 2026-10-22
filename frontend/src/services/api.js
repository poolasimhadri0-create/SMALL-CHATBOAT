const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function fetchConversations(search = '') {
  const url = search.trim()
    ? `${API_BASE_URL}/api/conversations?q=${encodeURIComponent(search.trim())}`
    : `${API_BASE_URL}/api/conversations`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load conversations: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchConversation(id) {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function renameConversation(id, title) {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title.trim() }),
  });
  if (!response.ok) {
    throw new Error(`Failed to rename conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteConversation(id) {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return { ok: false, error: 'Degraded' };
    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
