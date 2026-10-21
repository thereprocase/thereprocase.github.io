/** Shared cancellation is checked only at normal-flow boundaries, never in finally. */
export function createNativeCancellation(buffer, enabled) {
  const token = enabled && typeof SharedArrayBuffer !== 'undefined' &&
    buffer instanceof SharedArrayBuffer && buffer.byteLength === 4 ? new Int32Array(buffer) : null;
  const aborted = new DOMException('Conversion cancelled after native cleanup.', 'AbortError');
  const check = () => { if (token && Atomics.load(token, 0)) throw aborted; };
  const wait = async promise => {
    check();
    if (!token) return promise;
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setInterval(() => { if (Atomics.load(token, 0)) reject(aborted); }, 25);
      })]);
    } finally { clearInterval(timer); }
  };
  return { check, wait, enabled: Boolean(token), isCancellation: error => error === aborted };
}
