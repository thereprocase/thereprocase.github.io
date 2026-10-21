# Native kernel changes

These files record the changes used by the private STEP export candidate. They do not indicate that the candidate is deployed publicly or meets the timing target. The converter's release provenance identifies the deployed artifacts.

`destructor-generator.patch` fixes owning Embind destructors in the pinned binding generator. Classes with both ordinary and placement delete must release their native allocation. The change preserves the existing suppression for inaccessible destructors and classes with placement delete only.

`step-verifier-reader.patch` applies to the OCCT revision in its adjacent JSON manifest. It adds exact edge-deviation checking and preserves the writer's pcurves and parameter intervals. This reader is restricted to independently verifying STEP generated from already validated application CAD. General model imports use a separate exact-deviation backport with ordinary STEP processing and no verifier-only pcurve/range suppression. Its two model WASM hashes are `5deffc2a6307310bf54f161cf5f862ad72f0ddfcc14cb010258d2432a82a0a2c` (threaded) and `1569b1da4f75f7bcebddf8e18f1f32bd44388c8c00972cdb45923dc389f9078d` (single). Independent grammar audits of the supplied pencil cup and 3×4 solid showed only tolerance metadata changes, with identical curves, surfaces, topology references and ranges. The release retains the original preservation-guarded preparation path. The patch was applied to clean pinned upstream files and reproduced all four audited source files byte for byte.

`model-reader-exact.patch` and its adjacent JSON record the separate general-import patch against the pinned OCCT revision. Threaded and single-threaded builds use byte-identical patched source files. The release pairs these kernels with guarded preparation, matching the owner-tested import-fix route. Experimental valid-first preparation from003743 is excluded.

`native-parallel-optimal-bounds.cpp` distributes the existing exact AddOptimal work across faces, merges results deterministically, and includes free edges and vertices. Its output was compared with the serial implementation on 24 fixtures and the pencil cup. It does not substitute display-mesh bounds for native geometry bounds.

`verified-candidate-kernels.json` records the JS and WASM artifacts tested in private build 234753. The model and export-verifier kernels have separate single-threaded and four-thread variants. Any subsequent native change requires new artifact hashes and regeneration of the private source-certificate build fingerprint.

Acceptance still requires strict independent reopened validity, one positive-volume solid, source tolerance ceilings, and geometry-preservation checks. The full cup also received an independent pcurve/control-data/parameter-range comparison and tight adaptive volume comparison. A skipped-general-repair experiment failed validity and is excluded from this candidate.

Windows build 234753 completed foot conversion in 17.61 seconds, base-pose STEP export in 33.40 seconds, and original-pose STEP export in 37.37 seconds in one fresh-process run. This evidence does not establish reliable exports under 20 seconds. Further optimization and repeated Windows qualification remain required.
