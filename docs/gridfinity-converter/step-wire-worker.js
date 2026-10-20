import { fastStepWire } from './step-wire.js?v=native-local-20261020-1';
self.onmessage = ({ data }) => {
  try {
    const result = fastStepWire(data.buffer);
    self.postMessage(result, [result.vertices.buffer]);
  } catch (error) {
    // This is an optional display path. The native importer continues unchanged.
    self.postMessage({ skipped: error.message ?? String(error) });
  }
};
