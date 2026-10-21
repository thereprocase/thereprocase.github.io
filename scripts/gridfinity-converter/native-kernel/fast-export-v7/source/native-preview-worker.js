import { previewNative, prepareNativeDocument } from './native-cad.js?v=fast-export-20261021-025000';
let queued = Promise.resolve();
self.onmessage = ({ data }) => {
  queued = queued.then(() => handle(data)).catch(error => {
    self.postMessage({ error: error.message ?? String(error), requestId: data.requestId });
  });
};
async function handle(data) {
  if (data.type === 'prepare') {
    try {
      const preparation = await prepareNativeDocument({ ...data,
        onProgress: (progress, progressInfo) => self.postMessage({ preparation: true, progress, progressInfo }),
      });
      self.postMessage({ preparation: true, done: true, report: preparation });
    } catch (error) {
      self.postMessage({ preparation: true, error: error.message ?? String(error) });
    }
    return;
  }
  if (data.type === 'convert') {
    const { runNativeConversion } =
      await import('./native-worker-run.js?v=fast-export-20261021-025000');
    await runNativeConversion(data);
    // Each conversion consumes its validation child. Warm the next child while
    // the user reviews the result, without posting another conversion response.
    if (data.retainDocument) {
      try {
        const { prewarmNativeBrepValidator } = await import('./native-worker-run.js?v=fast-export-20261021-025000');
        await prewarmNativeBrepValidator();
      } catch { /* Optional warming never changes a conversion result. */ }
    }
    return;
  }
  try {
    const payload = await previewNative({
      ...data,
      onProgress: (progress, progressInfo) =>
        self.postMessage({ progress, progressInfo }),
    });
    const transfers = payload.result.meshes.flatMap((mesh) => [
      mesh.attributes.position.array.buffer,
      mesh.index.array.buffer,
    ]);
    self.postMessage(payload, transfers);
    if (payload.nativeDocumentId || payload.result?.nativeDocumentId) {
      try {
        const { prewarmNativeBrepValidator } = await import('./native-worker-run.js?v=fast-export-20261021-025000');
        await prewarmNativeBrepValidator();
      } catch { /* Optional warming must not invalidate the delivered preview. */ }
    }
  } catch (error) {
    self.postMessage({ error: error.message ?? String(error), requestId: data.requestId });
  }
}
