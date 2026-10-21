# Primary exact-validation overlap source bundle

Base application commit: `edeb5ea048ac3ddcae2ee288a782b639dfcfb8bb`.
This directory records the tested isolated implementation and its build inputs. It does not modify the application runtime. No WASM, object files, model files, credentials or raw diagnostic logs are included. Windows qualification was still pending when this bundle was prepared.

`native-async-exact.cpp` is the exact clean helper compiled into the qualified artifact. It runs the unchanged exact `BRepCheck_Analyzer(snapshot, true, true, true)` on an independent deep geometry snapshot, with two participants for the checker and two for the primary operations. The independent reopened-BREP validation remains a separate acceptance gate. Nonblocking `pthread_tryjoin_np` establishes retirement before restoring the pool budget. An unfinished native job must never be deleted; native traps quarantine ownership until the entire owning worker is terminated. Successful provisional preservation facts become an accepted proof only after primary exact validation passes.

The helper is enabled only for the supported four-thread kernel with an existing independent candidate snapshot. Single-thread, two-thread and unsupported paths retain synchronous validation. `tested-js/native-async-primary.js` is the tested adapter source, copied without modification. Runtime integration file hashes are in `evidence/final-site-provenance.json`; no runtime patch is applied by this bundle.

## Build requirements and commands

This is a cached-object relink recipe, **not a turnkey clean rebuild**. It depends on the pinned image and precompiled inputs listed with complete hashes in `provenance/cached-inputs.json`. The image ID, OCCT/opencascade.js/toolchain revisions and output hashes are recorded in `provenance/`. The generated upstream provenance retains inherited cache-build timestamps; it is not a fresh date or proof that all OCCT sources were rebuilt. The full SHA256 values in `artifacts.json` identify the actual resulting files.

Stage a writable `/src` build directory from this bundle. Supply the externally cached `mimalloc-diagnostics.o`, `out-multi/ShapeAnalysis_Edge.cxx.o`, and `out-multi/ShapeFix_Edge.cxx.o` at their original relative paths after verifying their hashes. Mount the corrected bindings cache at `/fixed-objects` and a directory containing the included destructor-generator patch at `/fixed-input`. The clean helper must occupy `/src/native-async-exact.cpp`. The script recompiles the helper and guarded topology-copy helper, reuses the corrected binding cache, patches the binding generator for generated wrapper destructors, inserts the two exact-reader objects, and links with mimalloc. Allocator and reader behavior are unchanged by this feature.

The tested container invocation used the local Docker daemon and an explicit shell entrypoint (the image's default entrypoint does not accept a shell command):

```sh
env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
  docker --host=unix:///var/run/docker.sock run --rm \
  --entrypoint /bin/bash \
  -v "$BUILD_DIR:/src" \
  -v /home/repro/occt-destructor-audit/repaired-objects:/fixed-objects:ro \
  -v /home/repro/occt-destructor-audit:/fixed-input:ro \
  ghcr.io/taucad/opencascade.js:canary-ebd263f1-multi-threaded /src/build.sh
python3 "$BUILD_DIR/patch-pool4.py" \
  "$BUILD_DIR/build-config/primary_async_multi.js" \
  "$BUILD_DIR/build-config/primary_async_multi_pool4.js"
```

Verify the image ID before execution. The generated pool4 glue caps the prewarmed pool and exposes worker-created notifications; its generated basename is preserved for pthread loading. The raw sibling JS and WASM are required at runtime. An inherited unresolved `mallinfo` warning was present; the clean smoke confirmed the intended scoped mimalloc API rather than a dlmalloc diagnostic interface.

Regenerate the private source certificate kernel mapping whenever the issuer artifact changes. The tested mapping and all issuer/verifier hashes are in `evidence/certificate-generation.json`. Do not reuse a stale build fingerprint.

## Tests and evidence

Tests are copied unchanged from the qualification workspace. They retain explicit local paths to that workspace, existing application dependencies and external fixtures; this bundle does not claim they run standalone. For replay, recreate those paths or deliberately adapt a separate copy. The actual benchmark/runtime source has not been reformatted or altered here.

- `tests/check-adapter.mjs`: nonblocking retirement, failed checker, cancellation drain, poisoned lifecycle, no unfinished deletion.
- `tests/check-clean.mjs`: real four-thread WASM valid and null-shape checks, pool restoration, unchanged source serialization, and absence of the audit trap export.
- `tests/check-app.mjs`: browser normal conversion and cancellation after the explicit job-start event, same-worker retry and strict STEP.
- `tests/check-app-trap.mjs`: actual main and background native traps while a cancellation token is set, plus ordinary error after job start. Native traps terminate the worker, do not acknowledge a clean cancel or publish a result, and allow a fresh-worker retry and strict STEP. Ordinary errors retire the job before cleanup.
- `tests/probe.cpp`: native scheduling prototype with source/result/snapshot invariance and exact preservation workload. Its external CAD inputs are deliberately excluded.

`evidence/lifecycle-summary.json` summarizes successful test exits. `evidence/full-cup-summary.json` records source/result hashes, exact baseline BREP equality, unchanged source volumes, outside-change zero, actual async retirement before publication, and independently validated STEP in both poses. It is a curated result summary, not a private raw log. Local timing is correctness evidence, not a Windows performance guarantee. Background `elapsedMS` measures the native checker; start/finish timestamps include observed retirement. Neither is conversion wall time, and overlapping phase durations must not be added.

## Audit-only trap build

`audit-only/native-async-exact.cpp` is the tested audit variant. The extra hook exists only with `NATIVE_ASYNC_AUDIT`; `build-audit.sh` sets that flag and emits separately named audit artifacts. To reproduce it, use a separate staging directory and place this audit source at its `native-async-exact.cpp` path. It deliberately executes a real background WASM trap after the analyzer, before completion publication. The audit browser worker also deliberately deletes an unfinished job to exercise the native main-thread trap path. Those injection edits were confined to a separate test site and are not clean runtime behavior.

Never serve the audit artifact as the clean candidate. The clean smoke asserts `nativeAsyncAuditTrapNext` is absent. Both artifact hashes are recorded to distinguish them. The final clean artifact was preserved throughout audit testing and reused after verifying its hash; it was not needlessly relinked.
