#!/bin/bash
set -euo pipefail
source /emsdk/emsdk_env.sh >/dev/null 2>&1
export OCJS_CONFIG=single-threaded
cp -a /fixed-objects/. /opencascade.js/build/compiled-bindings/
cd /opencascade.js
patch -p1 < /fixed-input/destructor-generator.patch
cd /src
for name in native-analytic-optimal-bounds native-parallel-optimal-bounds native-step-writer17 StepData_StepWriter; do
  suffix=cpp; [[ "$name" == StepData_StepWriter ]] && suffix=cxx
  em++ -std=c++17 -O3 -msimd128 -fwasm-exceptions -DOCJS_EXCEPTIONS_ENABLED=1 -DOCCT_NO_DUMP -UOCC_CONVERT_SIGNALS -DOCCT_NO_PLUGINS -DIGNORE_NO_ATOMICS=1 -frtti -I/src -I/opencascade.js/build/occt-includes -c "$name.$suffix" -o "$name.o"
done
emar r /opencascade.js/build/occt-libraries/libTKShHealing.a /reader-objects/ShapeAnalysis_Edge.cxx.o /reader-objects/ShapeFix_Edge.cxx.o
# Preserve the original archive member filename so the replacement is exact.
cp StepData_StepWriter.o StepData_StepWriter.cxx.o
emar r /opencascade.js/build/occt-libraries/libTKDESTEP.a /reader-objects/StepToTopoDS_TranslateEdgeLoop.cxx.o StepData_StepWriter.cxx.o
python3 - <<'PY'
import json,hashlib,pathlib
p=pathlib.Path('/opencascade.js/build/occt-libraries/manifest.json');x=json.loads(p.read_text())
for f in x['files']:
 if f['path'] in ['libTKShHealing.a','libTKDESTEP.a']:
  b=(p.parent/f['path']).read_bytes();f['sha256']=hashlib.sha256(b).hexdigest();f['size']=len(b)
p.write_text(json.dumps(x));pathlib.Path('/src/library-manifest.json').write_text(json.dumps(x,indent=2))
PY
em++ -std=c++17 -O3 -msimd128 -fwasm-exceptions -c build-config/wrappers/allocator-stats.cpp -o allocator-stats.o
export OCJS_OUTPUT_DIR=/src/build-config OCJS_SKIP_WASM_OPT=1
/opencascade.js/build-wasm.sh link /src/build-config/analytic_writer17_single_verifier.yml
