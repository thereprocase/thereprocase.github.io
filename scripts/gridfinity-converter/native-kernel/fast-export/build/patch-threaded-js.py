#!/usr/bin/env python3
"""Apply the two documented worker lifecycle/pool patches to generated JS."""
from pathlib import Path
import hashlib,json,re,sys
p=Path(sys.argv[1]);s=p.read_text();before=hashlib.sha256(s.encode()).hexdigest()
assert 'h.onPthreadWorker?.(a)' not in s, 'Input is already patched'
s,n=re.subn(r'(name:"em-pthread"\}\);)([\w$]+\.push\(a\))',r'\1h.onPthreadWorker?.(a);\2',s)
assert n==1, 'Pinned generated worker pattern changed; review instead of guessing'
old='for(var a=navigator.hardwareConcurrency;a--;)' 
assert s.count(old)==1, 'Pinned generated pool pattern changed; review required'
p.write_text(s)
q=p.with_name(p.stem+'_pool4.js');q.write_text(s.replace(old,'for(var a=Math.max(1,Math.min(4,h.pthreadPoolSize??navigator.hardwareConcurrency));a--;)'))
print(json.dumps({'originalSHA256':before,'rawJS':str(p),'pool4JS':str(q),'rawSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'pool4SHA256':hashlib.sha256(q.read_bytes()).hexdigest()},indent=2))
