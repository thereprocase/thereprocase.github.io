import { runNativeConversion } from './native-worker-run.js?v=native-local-20261020-1';
self.onmessage = ({ data }) => runNativeConversion(data);
