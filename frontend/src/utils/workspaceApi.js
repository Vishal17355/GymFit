export async function workspaceRequest(request, path = '', options) {
  const response = await request(`/api/workspace${path}`, options);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.error || (response.status === 401
      ? 'Sign in to continue.'
      : 'Could not reach the workspace. Try again.'));
  }
  return result;
}

export function changeWorkspace(request, action, fields) {
  return workspaceRequest(request, `/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

export function storedDetails(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}
