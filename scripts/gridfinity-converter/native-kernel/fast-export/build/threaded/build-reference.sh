#!/bin/bash
set -euo pipefail
source /emsdk/emsdk_env.sh >/dev/null 2>&1
cp -a /fixed-objects/. /opencascade.js/build/compiled-bindings/
cd /opencascade.js
patch -p1 < /fixed-input/destructor-generator.patch
cd /src
em++ -std=c++17 -O3 -msimd128 -pthread -fwasm-exceptions -DOCJS_EXCEPTIONS_ENABLED=1 -DOCCT_NO_DUMP -UOCC_CONVERT_SIGNALS -DOCCT_NO_PLUGINS -DIGNORE_NO_ATOMICS=1 -frtti -I/opencascade.js/build/occt-includes -c native-step-writer17.cpp -o native-step-writer17.o
em++ -std=c++17 -O3 -msimd128 -pthread -fwasm-exceptions -DOCJS_EXCEPTIONS_ENABLED=1 -DOCCT_NO_DUMP -UOCC_CONVERT_SIGNALS -DOCCT_NO_PLUGINS -DIGNORE_NO_ATOMICS=1 -frtti -I/opencascade.js/build/occt-includes -c StepData_StepWriter.cxx -o StepData_StepWriter.cxx.o
em++ -std=c++17 -O3 -msimd128 -pthread -fwasm-exceptions -DOCJS_EXCEPTIONS_ENABLED=1 -DOCCT_NO_DUMP -UOCC_CONVERT_SIGNALS -DOCCT_NO_PLUGINS -DIGNORE_NO_ATOMICS=1 -frtti -I/opencascade.js/build/occt-includes -c native-analytic-optimal-bounds.cpp -o native-analytic-optimal-bounds.o
em++ -std=c++17 -O3 -msimd128 -pthread -fwasm-exceptions -DOCJS_EXCEPTIONS_ENABLED=1 -DOCCT_NO_DUMP -UOCC_CONVERT_SIGNALS -DOCCT_NO_PLUGINS -DIGNORE_NO_ATOMICS=1 -frtti -I/opencascade.js/build/occt-includes -c native-parallel-optimal-bounds.cpp -o native-parallel-optimal-bounds.o
emar r /opencascade.js/build/occt-libraries/libTKShHealing.a /reader-objects/ShapeAnalysis_Edge.cxx.o /reader-objects/ShapeFix_Edge.cxx.o
emar r /opencascade.js/build/occt-libraries/libTKDESTEP.a /reader-objects/StepToTopoDS_TranslateEdgeLoop.cxx.o /src/StepData_StepWriter.cxx.o
python3 - <<'PY'
import json,hashlib,pathlib
p=pathlib.Path('/opencascade.js/build/occt-libraries/manifest.json');x=json.loads(p.read_text())
for f in x['files']:
 if f['path'] in ['libTKShHealing.a','libTKDESTEP.a']:
  b=(p.parent/f['path']).read_bytes();f['sha256']=hashlib.sha256(b).hexdigest();f['size']=len(b)
p.write_text(json.dumps(x))
PY
cd /src/build-config
export OCJS_MALLOC=mimalloc OCJS_OUTPUT_DIR=/src/build-config OCJS_SKIP_WASM_OPT=1
/opencascade.js/build-wasm.sh link /src/build-config/writer17_torus_verifier.yml
