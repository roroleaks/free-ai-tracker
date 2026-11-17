export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const { timeout = timeoutMs, signal: userSignal, ...rest } = options;
  const signal = userSignal || AbortSignal.timeout(timeout);
  return fetch(url, { ...rest, signal });
}

export default fetchWithTimeout;
