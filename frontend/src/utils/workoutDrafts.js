async function requestDraft(request, key, options) {
  const response = await request(`/api/workout-drafts/${encodeURIComponent(key)}`, options);
  if (!response.ok) throw new Error('Workout draft storage is unavailable.');
  return response.json();
}

export async function loadWorkoutDraft(request, key, signal) {
  const { draft } = await requestDraft(request, key, { signal });
  return draft;
}

export async function saveWorkoutDraft(request, key, draft) {
  await requestDraft(request, key, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
    signal: AbortSignal.timeout(12000),
  });
}
