import { runNativeConversion } from './native-worker-run.js?v=native-step-20261021-3';
self.onmessage = ({ data }) => runNativeConversion(data);
