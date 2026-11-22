import { fetchMemberApi } from './memberApiSession';

export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR', fields = {}) {
    super(message); this.name = 'ApiError'; this.status = status; this.code = code; this.fields = fields;
  }
}

export function createApiClient({ fetchImpl = fetchMemberApi, timeoutMs = 20000, serviceName = 'Diet API' } = {}) {
  return async (path, { method = 'GET', body, signal, responseType } = {}) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    try {
      const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
      const headers = { Accept: responseType === 'blob' ? 'image/jpeg, application/json' : 'application/json',
        ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}) };
      const response = await fetchImpl(path, {
        method, headers, signal: controller.signal, ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {})
      });
      if (response.status === 204) return null;
      if (response.ok && responseType === 'blob') return await response.blob();
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { throw new ApiError(`The ${serviceName} returned an unexpected response. Check the backend URL and proxy.`, response.status); }
      if (!response.ok) throw new ApiError(data?.message || (response.status === 401 ? 'Sign in to continue.'
        : response.status === 403 ? 'This action requires a current member session.' : `${serviceName} request failed (${response.status}).`), response.status, data?.code, data?.fields);
      return data;
    } catch (error) {
      if (error instanceof ApiError || signal?.aborted) throw error;
      if (controller.signal.aborted) throw new ApiError(`The ${serviceName} request timed out. Try again.`);
      throw new ApiError(`Cannot reach the ${serviceName}. Try again.`);
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
    }
  };
}
