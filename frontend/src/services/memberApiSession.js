let sessionRequest;

export function bindMemberApiSession(request) {
  sessionRequest = request;
  return () => {
    if (sessionRequest === request) sessionRequest = undefined;
  };
}

export function fetchMemberApi(path, options) {
  const request = sessionRequest;
  if (!request) throw new Error('Your GymFit session is unavailable.');
  return request(path, options);
}
