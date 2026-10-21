import { runNativeConversion } from './native-worker-run.js?v=native-step-20261021-1';
self.onmessage = ({ data }) => runNativeConversion(data);
