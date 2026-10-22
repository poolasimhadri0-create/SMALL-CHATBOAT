export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('chatbot_backend_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/$/, '');
    }
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000';
  }
  // Production default: directly connect to deployed Render backend
  return 'https://small-chatboat.onrender.com';
}

export async function fetchConversations(search = '') {
  const baseUrl = getApiBaseUrl();
  const url = search.trim()
    ? `${baseUrl}/api/conversations?q=${encodeURIComponent(search.trim())}`
    : `${baseUrl}/api/conversations`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load conversations: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchConversation(id) {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/conversations/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function renameConversation(id, title) {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/conversations/${id}`, {
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
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.statusText}`);
  }
  return response.json();
}
