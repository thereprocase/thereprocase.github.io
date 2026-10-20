import { previewNative } from './native-cad.js?v=cad-progress-1';
self.onmessage = async ({ data }) => {
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
  } catch (error) {
    self.postMessage({ error: error.message ?? String(error) });
  }
};
