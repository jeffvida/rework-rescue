// Submission adapter. The only code in this project that can send data off the page.
//
// Returns one of:
//   { status: 'unconfigured' }              no endpoint set: nothing is sent, and the UI says so honestly
//   { status: 'sent' }                      the endpoint answered with a 2xx status
//   { status: 'failed', reason }            network error, timeout or non-2xx answer
//
// Never logs the payload and never reports success unless the endpoint confirmed it.

export async function submitInquiry(payload, { endpoint = '', fetchImpl, timeoutMs = 15000 } = {}) {
  if (!endpoint) return { status: 'unconfigured' };
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { status: 'failed', reason: 'no-fetch' };

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller ? controller.signal : undefined,
    });
    if (res && res.ok) return { status: 'sent' };
    return { status: 'failed', reason: `http-${res ? res.status : 'none'}` };
  } catch (err) {
    return { status: 'failed', reason: err && err.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
