import { runNativeConversion } from './native-worker-run.js?v=female-bases-20261021-3';
self.onmessage = ({ data }) => runNativeConversion(data);
