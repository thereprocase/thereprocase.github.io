#!/bin/bash
set -euo pipefail
source /emsdk/emsdk_env.sh >/dev/null 2>&1
cp -a /fixed-objects/. /opencascade.js/build/compiled-bindings/
cd /opencascade.js
patch -p1 < /fixed-input/destructor-generator.patch
cd /src
em++ -std=c++17 -O3 -msimd128 -pthread -fwasm-exceptions -DOCJS_EXCEPTIONS_ENABLED=1 -DOCCT_NO_DUMP -UOCC_CONVERT_SIGNALS -DOCCT_NO_PLUGINS -DIGNORE_NO_ATOMICS=1 -frtti -I/opencascade.js/build/occt-includes -c native-topology-copy.cpp -o native-topology-copy.o
em++ -std=c++17 -O3 -msimd128 -pthread -fwasm-exceptions -DOCJS_EXCEPTIONS_ENABLED=1 -DOCCT_NO_DUMP -UOCC_CONVERT_SIGNALS -DOCCT_NO_PLUGINS -DIGNORE_NO_ATOMICS=1 -frtti -I/opencascade.js/build/occt-includes -DNATIVE_ASYNC_AUDIT=1 -c native-async-exact.cpp -o native-async-exact-audit.o
emar r /opencascade.js/build/occt-libraries/libTKShHealing.a out-multi/ShapeAnalysis_Edge.cxx.o out-multi/ShapeFix_Edge.cxx.o
python3 - <<'PY'
import json,hashlib,pathlib
p=pathlib.Path('/opencascade.js/build/occt-libraries/manifest.json');x=json.loads(p.read_text())
for f in x['files']:
 if f['path']=='libTKShHealing.a':
  b=(p.parent/f['path']).read_bytes();f['sha256']=hashlib.sha256(b).hexdigest();f['size']=len(b)
p.write_text(json.dumps(x))
PY
export OCJS_MALLOC=mimalloc OCJS_OUTPUT_DIR=/src/build-config OCJS_SKIP_WASM_OPT=1
/opencascade.js/build-wasm.sh link /src/build-config/primary_async_audit_multi.yml
