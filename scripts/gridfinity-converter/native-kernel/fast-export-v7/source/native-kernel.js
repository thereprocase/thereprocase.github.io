import initSingle from './vendor/replicad/model_exact_single.js';
const runtime = new WeakMap();
export function nativeKernelInfo(oc) {
  return runtime.get(oc) ?? { engine: 'single', threads: 1, purpose: 'model' };
}
/** Independent pools per native worker, bounded to leave room for the UI. */
export async function initNativeKernel({purpose='model'} = {}) {
  if (!['model','step-export-verifier'].includes(purpose)) throw Error('Unknown CAD kernel purpose');
  const verifier = purpose === 'step-export-verifier';
  const available = Number(globalThis.navigator?.hardwareConcurrency) || 1;
  const threads = Math.max(1, Math.min(4, Math.floor(available)));
  let fallbackReason;
  if (
    globalThis.crossOriginIsolated === true &&
    typeof SharedArrayBuffer === 'function' &&
    threads >= 2
  ) {
    const children = new Set();
    let abandoned = false,
      timer;
    try {
      const attempt = (async () => {
        const { default: initMulti } =
          await import(verifier ? './vendor/export-verifier/writer17_torus_verifier_pool4.js' : './vendor/replicad/topology_copy_guarded_multi_pool4.js');
        return initMulti({
          pthreadPoolSize: threads,
          onPthreadWorker: (worker) => {
            if (abandoned) worker.terminate();
            else children.add(worker);
          },
        });
      })();
      const oc = await Promise.race([
        attempt,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(Error('Threaded CAD initialization timed out.')),
            20000,
          );
        }),
      ]);
      clearTimeout(timer);
      const pool = oc.OSD_ThreadPool.DefaultPool(threads);
      try {
        pool.Init(threads);
        pool.SetNbDefaultThreadsToLaunch(threads);
        if (pool.NbThreads() !== threads)
          throw Error('Native CAD thread pool size differs.');
      } finally {
        pool.delete();
      }
      if (!(oc.wasmMemory.buffer instanceof SharedArrayBuffer))
        throw Error('Native CAD shared memory unavailable.');
      runtime.set(oc, { engine: 'pthread', threads, purpose });
      return oc;
    } catch (error) {
      abandoned = true;
      clearTimeout(timer);
      for (const worker of children) worker.terminate();
      children.clear();
      fallbackReason = error.message ?? String(error);
    }
  }
  const initializeSingle = verifier ? (await import('./vendor/export-verifier/analytic_writer17_single_verifier.js')).default : initSingle;
  const oc = await initializeSingle();
  runtime.set(oc, {
    engine: 'single',
    threads: 1,
    purpose,
    ...(fallbackReason ? { fallbackReason } : {}),
  });
  return oc;
}
