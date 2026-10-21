import { runNativeConversion } from './native-worker-run.js?v=fast-export-20261021-025000';
self.onmessage = ({ data }) => runNativeConversion(data);
