Gridfinity v7 source and qualification bundle

Unpublished review bundle. Do not treat this folder as a deployed site or a
turnkey clean build. The guarded native artifact and staged v7 source snapshot are reconciled.
Combined small-browser normal/cancel/retry strict STEP qualification passed.
The v7 candidate is privately deployed; this bundle is unpublished.
This source snapshot preceded Windows qualification. Subsequent results are recorded in public/gridfinity-converter/checks/windows-native-step-3.json:17 conversions and11 strict STEP exports passed, with one quiet-host fresh conversion above20seconds. The performance objective remains open.

The authoritative public baseline is commit
9379c78024488dad947cce729ebfc363700b572a in the gridfinity-fast-release checkout,
public/gridfinity-converter. This is the public v3 source, not the older main
checkout. source-mapping.json records individual baseline and candidate hashes.

patches/public-v3-to-v7-exact.diff preserves runtime tokens and the private
candidate's diagnostic script reference. It covers handwritten converter files
and the modified Replicad source, not generated native glue/WASM artifacts.
patches/public-v3-to-v7-logical-review.diff changes only the two explicitly listed
build tokens to <BUILD_TOKEN> and removes the single listed private diagnostic
script element. This normalized patch is for review, not direct application.
No diagnostic script or raw diagnostic log is included in this bundle.

The individual cooperative-cancel, cancellation-boundary, source-volume-cache,
export-startup and vendor ownership patches retain their original review
boundaries. They are not an ordered patch series: some were prepared against
intermediate private candidates. The aggregate public-to-v7 patch is the
baseline mapping. source/ contains the candidate handwritten files and patched
Replicad source, preserving exact candidate bytes.

Changes being reviewed:
- Cooperative cancellation checks at normal flow boundaries, with a unique
  cancellation exception, child-task settlement and cleanup before clean ack.
  Native traps and cleanup exceptions must never acknowledge a reusable worker.
  A timeout still destroys the worker and preserves original input for retry.
- Explicit Replicad loft and curve-edge temporary-handle disposal.
- Source signed/absolute volume reuse only on the same retained document/body
  and exact scale/rotation/translation key. No work moves into preparation.
  Failed bounds/volume matching does not replace a valid cached placement.
- Native preparation propagates WebAssembly.RuntimeError without attempting
  recovery inside a potentially damaged kernel.
- One export warm slot renews its idle timeout on recent conversion activity.
  Module-only bounds-child warmup transfers ownership once. Cold main kernel
  and bounds-child startup proceed concurrently; the real startup handshake,
  source identity checks, independent STEP reopen and all validation remain.
- The guarded topology-only snapshot is for the primary exact checker only.
  The independent serialized export snapshot stays on the prior deep-copy path.
  Unsupported shapes fall back. Final guarded source/artifact provenance is
  supplied by the build owner; unguarded prototype timing alone is not release
  qualification.

Evidence and limits:
- Six native cancellation-boundary cases preserved the canonical source and
  passed retries; small browser cancellation, timeout and before-prepared
  recovery paths were exercised. A local full-cup four-second cancellation hit
  the hard fallback, then successfully converted and exported STEP. It is not
  evidence of clean cancellation on that machine. Parent-reported Windows
  results are explicitly distinguished from locally reproduced evidence.
- Ten matching baseline-v5/patched source-volume test sequences produced
  byte-identical native BREP outputs. No BREP files are included; hashes are in
  the evidence summary. Cold-versus-retained representation bookkeeping can
  differ even without this cache; bidirectional empty native Boolean differences
  were checked separately. No general symbolic equality claim is made.
- Local small-fixture export samples improved cold startup from 1693.67 ms to
  1559.65 ms and warm export from 1053.85 ms to 931.02 ms. One sample per mode is
  not a Windows or full-cup performance guarantee. Additional warmup measured
  approximately 14 ms in that sample; conversion contention needs qualification.
- Real browser warm/dispose rounds left no workers. Page-hide cancellation
  preserved the conversion, terminated the nested worker subtree, and allowed
  a new strict STEP export. Cleanup drained within 2.7 seconds in that run.
- A legitimate export after more than 60 seconds without activity may be cold.
  The fix does not extend an idle kernel's life indefinitely. Delayed Windows
  exports and all combined v7 release checks remain separate release gates.

Build reproduction scope:
The topology build script/config refer to a pinned container image, existing
corrected generated-binding object cache, upstream exact-reader object files,
and mimalloc diagnostics objects. Manifests record those inputs and hashes.
This bundle does not contain those object caches, WASM binaries, a full OCCT
source tree, every dependency tarball, or private models. It therefore supports
source review and artifact provenance checks, not an isolated from-scratch build.
The build commands retain their original absolute mount paths; adapting paths
and recreating the external inputs is required before execution.

Test reproduction scope:
Tests retain their reviewed source and may reference original /tmp or /home/repro
paths, prepared fixture manifests, browsers and helper servers. Synthetic fixture
constructors are included where used. Adjust imports and provide declared test
runtime dependencies before running elsewhere. No private model, STEP, BREP,
STL, raw diagnostic log, or native binary is distributed in this bundle.

SHA256SUMS describes the finalized bundle contents, excluding itself. Its
presence certifies file integrity only, not that every release gate has passed.
