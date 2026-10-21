Combined STEP export verifier source bundle

Status
This is an isolated candidate, not the public release. It changes only the dedicated STEP export verifier. Model imports, replacement geometry, mesh export quality and validation thresholds are outside this change. Latest private Windows measurements are recorded below; final release review and full-workflow performance qualification are still required.

Contents
src/: exact custom C++ sources used by the combined threaded and single builds.
patches/: pinned OCCT writer buffer change, existing dedicated reader policy, and owning-destructor generator correction.
build/{threaded,single}/: actual build references, linker YAML and additional binding sources. Threaded uses mimalloc and selective repair; single retains dlmalloc and full general repair.
upstream/: immutable image digests, source/object/artifact hashes, licenses and prior policy provenance.
evidence/: small qualification summaries, numeric formatter test source/output, oracle results and fresh-cup geometry comparison. Private STEP/BREP models and compiled binaries are intentionally excluded.
SHA256SUMS: checksums of every other bundled file.

Changes
1. nativeWriteStep17(writer, filename) serializes an already transferred STEP model with %.16E (17 significant digits). It retains the schema/header and writer uncertainty policy. It does not modify the model geometry or tolerances.
2. Zero suppression is disabled. The pinned OCCT suppressor scans only 16 characters and can truncate exponents when given longer mantissas. The local Send(double) buffer grows from 24 to 64 bytes, preventing overflow for negative finite values with three-digit exponents.
3. The custom bounds helper replaces only finite ring-torus rectangular surface extrema. It preserves pinned trimming, edge bounds, AdjustFaceBox, face-order reduction and free edge/vertex handling. Unsupported or ill-conditioned inputs use the existing routine. See numerical-contract.txt for assumptions and fallbacks.
4. Existing independent STEP validity, solid count, volume, bounds and per-kind tolerance gates remain unchanged. Writer17 fixes the cup's decimal-rounding rejection rather than widening those gates.

Build reproduction
Use the image digests in upstream/build-inputs.json, not an unpinned latest tag. Emscripten is 5.0.1. The references are the commands actually used, not a self-contained offline bootstrap. They depend on the immutable image's CAD libraries and selected binding objects with the recorded destructor correction. No opaque new CAD library is required.

Mount an output workspace as /src, the selected corrected binding cache as /fixed-objects, patches/ as /fixed-input, and the matching threaded/single reader object cache as /reader-objects. Compare the cache SHA256 values against upstream/corrected-binding-object-hashes.json and upstream/reader-object-hashes.json before reuse. The historical cache paths are recorded solely as provenance; remap them when reproducing elsewhere.

If those caches are unavailable, regenerate the selected bindings from the pinned image with patches/destructor-generator.patch applied before generation/compilation. Rebuild the three reader translation units after applying patches/step-verifier-reader.patch to its pinned OCCT source, with the patched ShapeAnalysis header first on the include path. Use the same threading, exceptions, SIMD and optimization flags as the references. Upstream source hashes are in patches/step-verifier-reader.json. Do not use uncorrected cached bindings: their no-op native destructors leak objects.

The writer buffer patch applies under the pinned /occt root. Its original/patched file hashes are in upstream/build-inputs.json. Copy the patched StepData_StepWriter.cxx into the output workspace. Copy src/ into that workspace and the selected linker YAML plus wrappers into build-config/. The references compile these small custom sources and replace only the recorded reader members and StepData_StepWriter.cxx.o in the appropriate CAD archives.

The threaded reference originally reused native-step-processing.o and mimalloc-diagnostics.o. Their sources are included: compile src/native-step-processing.cpp and build/threaded/wrappers/mimalloc-diagnostics.cpp with the same threaded flags; add the wrappers directory to the include path for mimalloc.h. All other custom object compilation is explicit in the references. The single reference compiles allocator-stats.cpp explicitly. Update library-manifest hashes after archive replacement, as the references do, then run the pinned build-wasm.sh link command.

Apply build/patch-threaded-js.py to the completed threaded JS. It records created pthread workers for cleanup and writes a pool4 derivative that honors a bounded Module.pthreadPoolSize. It does not change navigator. Keep the raw JS, pool4 JS and WASM basenames together so pthread self-load and WASM resolution remain correct.

Application integration
Select the pool4 module only for the dedicated threaded STEP verifier and the corresponding single module for fallback. Change dedicated writeVerifierSTEP's writer.Write(filename) call to oc.nativeWriteStep17(writer, filename). The nativeAddOptimalParallel API is unchanged. Update both verifier hashes in the bounds-worker compatibility table and regenerate the source-certificate build fingerprint from all four actual issuer/verifier WASM files. Apply normal module cache versioning. Never point arbitrary model imports at this reader-policy kernel.

Qualification and limitations
Threaded: owning-handle tests, 24 standard bounds cases, 12 trimmed/oriented torus WASM cases, three difficult STEP faces, exact-double formatter checks, a tiny full STEP route and the fresh cup full route pass. The combined STEP DATA and entire readback BREP are byte-identical to the independently audited writer17 result. All 40,468 cup pcurve contexts and 7,924 surfaces were audited; topology counts are unchanged. The existing 1e-12 mm tolerance gate passes with residual approximately 1.186e-14 mm. Tight adaptive volume difference is approximately -1.295e-9 mm3.

The native formatter test uses the pinned conversion implementation and checks 13 finite doubles, including negative DBL_MAX, negative DBL_MIN/subnormal, signed zero and large/small exponents. Bitwise roundtrips, buffer canaries, AddressSanitizer and UndefinedBehaviorSanitizer pass.

The bounds oracle covers 96 cases at 90-digit precision: 94 accepted and 2 fallback, zero measured directional undercoverage. This is empirical coverage, not a formal floating-point proof. The numeric contract assumes the pinned musl sin/cos implementation fits the documented 64-epsilon envelope and the stated arithmetic budget. Final review must retain that distinction. Local timings are diagnostic and do not establish Windows speed.

Some positive-fit models still produce STEP tolerance redistribution that fails the unchanged per-kind gate. Those remain valid native BREP exports; this bundle does not claim to solve that separate limitation. Single full-cup validation also passes using full general repair. Its STEP DATA and complete readback BREP are byte-identical to the threaded result; see evidence/single-cup-comparison.json. Latest Windows stage timings are recorded below; release remains held.

Private qualification update — build fast-export-20261021-014000
Three fresh Windows runs reported preview 0.58–0.62 s, import 15.89–16.70 s, preparation complete 17.31–17.85 s, conversion 18.31–18.53 s, base STEP 18.34–18.47 s and original-pose STEP 17.90–19.13 s. All six exports passed. These are separate phase timings: selection through conversion remains about 36 s, followed by STEP export. Cancellation at 4.05 s retained retry capability, but retry took 35.04 s because source preparation repeated; the subsequent STEP passed in 18.53 s. See evidence/windows-014000-qualification.json. This worktree still stages 011800 runtime; neither this documentation nor those measurements qualify an untested subsequent candidate.

Earlier 011800 ten-swap evidence had flat 1866 MB primary WASM capacity but current-thread liveBlockBytes rose 60.5→99.6 MB, about 4.3 MB/swap. The latter is not total-process live allocation measurement. Its monotonic residue remains unexplained; flat capacity and ten successes are not an indefinite-memory guarantee. 014000 reported primary capacity 1734 MB; do not combine these different-build figures into one durability series.

The valid-first source and older guarded-preparation source differ by about 0.00064 mm3. Valid-first preserves an already strictly valid, consistently parameterized imported body rather than applying an unnecessary SameParameter reconstruction. Each conversion's preservation checks use its own source. The STEP audit compares the new output against the new validated source; byte identity to the older source/result is not claimed. This source baseline change is distinct from the approximately 1e-9 mm3 STEP readback delta and does not widen any gate.
