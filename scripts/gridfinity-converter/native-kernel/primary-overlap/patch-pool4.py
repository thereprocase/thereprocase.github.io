from pathlib import Path
import re,sys
raw=Path(sys.argv[1]);out=Path(sys.argv[2]);s=raw.read_text()
pattern=r'for\(var (\w+)=navigator.hardwareConcurrency;\1--;\)';m=re.search(pattern,s);assert m,'pool initializer changed'
module=re.search(r'(\w+)\.locateFile\?',s).group(1)
s=s[:m.start()]+f'for(var {m.group(1)}=Math.max(1,Math.min(4,{module}.pthreadPoolSize??navigator.hardwareConcurrency));{m.group(1)}--;)' +s[m.end():]
pattern=r'(new Worker\(new URL\("[^"]+",import.meta.url\),\{type:"module",workerData:"em-pthread",name:"em-pthread"\}\);)(\w+)\.push\((\w+)\)'
m=re.search(pattern,s);assert m,'worker registration changed'
s=s[:m.end(1)]+f'{module}.onPthreadWorker?.({m.group(3)});'+s[m.end(1):]
out.write_text(s)
