import { fastStepWire } from './step-wire.js?v=female-bases-20261021-3';
self.onmessage = ({ data }) => {
  try {
    const result = fastStepWire(data.buffer);
    self.postMessage(result, [result.vertices.buffer]);
  } catch (error) {
    // This is an optional display path. The native importer continues unchanged.
    self.postMessage({ skipped: error.message ?? String(error) });
  }
};
