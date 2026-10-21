import { validateNativeBrepCandidate, warmNativeBrepValidator } from './native-cad.js?v=native-step-20261021-3';
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'warm') {
      self.postMessage({ warming: true });
      await warmNativeBrepValidator(data);
      self.postMessage({ warm: true, warmedAtMS: Date.now() });
      return;
    }
    const result = await validateNativeBrepCandidate({ ...data,
      onReady: (timing) => self.postMessage({ ready: true, ...timing }),
      onProgress: (progress, progressInfo) => self.postMessage({ progress, progressInfo }),
    });
    self.postMessage({ result }, result.buffer ? [result.buffer] : []);
  } catch (error) {
    self.postMessage({ error: error.message ?? String(error), stack: error.stack });
  }
};
