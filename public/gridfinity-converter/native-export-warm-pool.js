/** One unused export kernel; every acquired worker is consumed once. */
export function createNativeExportWarmPool({
  createWorker = () => new Worker(new URL('./native-export-worker.js?v=native-step-20261021-5', import.meta.url), { type: 'module' }),
  startupMS = 30000,
  idleMS = 60000,
} = {}) {
  let slot;
  const owned = new Set();
  const abortError = () => new DOMException('Native export cancelled', 'AbortError');
  function stop(entry, outcome = { ready: false, cancelled: true }) {
    if (entry.closed) return;
    entry.closed = true;
    entry.cancelled = Boolean(outcome.cancelled);
    clearTimeout(entry.startupTimer);
    clearTimeout(entry.idleTimer);
    entry.worker.terminate();
    owned.delete(entry);
    if (slot === entry) slot = undefined;
    entry.settle(outcome);
  }
  function make(warm) {
    const worker = createWorker();
    let resolve;
    const entry = { worker, closed: false, settled: false, claimed: false,
      ready: new Promise(r => { resolve = r; }),
      settle(value) { if (!entry.settled) { entry.settled = true; resolve(value); } },
    };
    owned.add(entry);
    if (!warm) { entry.settle({ ready: false, cold: true }); return entry; }
    worker.onmessage = ({ data }) => {
      if (entry.closed) return;
      if (data?.warm === true) {
        clearTimeout(entry.startupTimer);
        entry.settle({ ready: true, elapsedMS: data.elapsedMS });
        if (!entry.claimed) entry.idleTimer = setTimeout(() => stop(entry), idleMS);
      } else if (data?.error) stop(entry, { ready: false, error: String(data.error) });
    };
    worker.onerror = () => stop(entry, { ready: false, error: 'Export warmup failed' });
    worker.onmessageerror = () => stop(entry, { ready: false, error: 'Unreadable warmup response' });
    entry.startupTimer = setTimeout(() => stop(entry, { ready: false, error: 'Export warmup timed out' }), startupMS);
    try { worker.postMessage({ type: 'warm' }); }
    catch (error) { stop(entry, { ready: false, error: String(error) }); }
    return entry;
  }
  return {
    prewarm() {
      if ([...owned].some(entry => entry.claimed)) return Promise.resolve({ ready: false, busy: true });
      if (!slot) {
        try { const entry = make(true); if (!entry.closed) slot = entry; return entry.ready; }
        catch (error) { return Promise.resolve({ ready: false, error: String(error) }); }
      }
      // Recent conversion activity renews the unused slot's idle lifetime.
      // Never renew an acquired worker or create a second speculative kernel.
      if (slot.idleTimer) {
        const entry = slot;
        clearTimeout(entry.idleTimer);
        entry.idleTimer = setTimeout(() => stop(entry), idleMS);
      }
      return slot.ready;
    },
    async acquire({ signal } = {}) {
      if (signal?.aborted) throw abortError();
      if ([...owned].some(entry => entry.claimed)) throw Error('Native export already active.');
      let entry = slot;
      slot = undefined;
      if (!entry) entry = make(false);
      entry.claimed = true;
      clearTimeout(entry.idleTimer);
      const cancel = () => stop(entry);
      signal?.addEventListener('abort', cancel, { once: true });
      let outcome = await entry.ready;
      if (signal?.aborted || (entry.closed && entry.cancelled)) {
        signal?.removeEventListener('abort', cancel);
        throw abortError();
      }
      // A failed speculative startup must not prevent a normal fresh export.
      if (entry.closed) {
        try { entry = make(false); entry.claimed = true; }
        catch (error) { signal?.removeEventListener('abort', cancel); throw error; }
        outcome = { ready: false, cold: true };
      }
      entry.worker.onmessage = entry.worker.onerror = entry.worker.onmessageerror = null;
      return {
        worker: entry.worker,
        prewarmed: outcome.ready === true,
        warmupMS: outcome.elapsedMS,
        release() { signal?.removeEventListener('abort', cancel); stop(entry); },
      };
    },
    dispose() { for (const entry of [...owned]) stop(entry); slot = undefined; },
  };
}
