# Gridfinity male base converter

Local browser tool for replacing male feet on an existing solid. Detects orientation, the standard foot profile and occupied cells on a fixed 42 mm grid. Displays the array extent and occupied-cell count. Missing cells are not filled automatically. The Convert feet button is always available in the persistent workflow bar once feet are selected; no confirmation checkbox is required.

Styles: plain, 6 × 2 mm magnets, cylindrical M3 holes, or both. Default profile widths are 35.6 / 37.2 / 37.2 / 41.5 mm at Z 0 / 0.8 / 2.6 / 4.75 mm, with corner radii 0.8 / 1.6 / 1.6 / 3.75 mm. Hardware centers are ±13 mm. Magnet pockets default to diameter 6.5 mm and depth 2.4 mm; screw holes to diameter 3 mm and a requested maximum depth of 6 mm. The UI defaults to fitting screw depth within existing material in 0.1 mm steps, with a 2 mm minimum; Exact depth keeps the requested depth and refuses insufficient roofs. The report records requested and actual depths. A minimum material roof is checked before cutting holes.

## Representations and formats

- STEP/STP and BREP/BRP: OpenCascade imports the original boundary representation, performs native CAD booleans, and offers BREP only after independently reopening and validating it. STEP translation is available on request and is checked before download; a failed STEP translation leaves the validated BREP available. The download button and report identify the actual format. Rounded profiles and bores are CAD surfaces. Original surfaces outside the edit regions remain CAD surfaces. Tessellation is only used for detection, preview and optional mesh exports (starting at 0.01 mm deflection; automatically adapted to browser capacity, with actual deviation recorded). Native CAD feature history is not reconstructed.
- STL, 3MF, OBJ, PLY, OFF, AMF, glTF/GLB, COLLADA and FBX: mesh operations with Manifold. Geometry outside the allowed edit masks is preserved within the stated volume tolerance; no global remeshing or smoothing. Face indexing/triangulation can change during boolean operations. Exports are STL and millimetre 3MF.
- IGES: currently imported as a tessellated mesh (starting at 0.025 mm deflection, automatically adapted for large previews). Export STEP from the source CAD application when native preservation is required.
- Unit metadata and static scene/component transforms are applied where available. STL/OBJ/PLY/OFF default to mm; FBX requires the user to choose units. Companion buffers must be selected with glTF files. Skinned poses must be baked.
- Disconnected parts are offered separately. Only the selected part is converted and exported. Colors, textures, original assembly structure and slicer settings are not preserved. Proprietary project files need an interchange export first.

## Geometry checks

The detector samples cross-sections at 0.2, 1.6 and 4.5 mm, estimates base orientation and yaw, checks the expanding rounded-square profile, and fits a common grid phase. Accepted centers are snapped to exact 42 mm spacing. A single cell establishes a profile match, not an independently measured pitch. Off-grid matches are not automatically selected. Manual integer cells and a common origin correction are available.

Conversion removes only selected foot regions, builds complete replacement feet, checks overlap across the full rounded foot profile (including perimeter walls of hollow bins) and hole roofs, then checks one connected solid. Mesh edge incidence and winding are checked before export. Native STEP/BREP additionally passes OpenCascade's geometric/topological validity analyzer. Both paths measure symmetric material change outside the union of replacement and requested hole regions; export is blocked above max(0.001 mm³, original volume × 1e-8). Tiny float32 normalization is bounded and recorded. These checks are digital geometry evidence, not a guarantee of physical fit or print strength.

Open/inconsistently wound inputs are rejected; coincident seam vertices are welded, but missing surfaces are not invented. Old cavities above the replacement seam can remain enclosed. Female sockets, baseplates and racks are out of scope. Processing limits: 50 MB per model, 1 million triangles for mesh input, 128 feet, 64 separate solids. Cancellation retains the selected input and settings. Prepared native conversions use cooperative cancellation when possible; unsupported stages or a missing acknowledgement terminate the worker and require native preparation again on retry.

## Reproducing checks

From the repository root:

```sh
node scripts/gridfinity-converter/check-kernel.mjs
node scripts/gridfinity-converter/make-fixtures.mjs public/converter-test-fixtures
node scripts/gridfinity-converter/check-native.mjs
# Generate IGES/BREP fixtures from part.step with OpenCascade, then:
CHECK_IMPORTS=1 node scripts/gridfinity-converter/check-browser.mjs public /tmp/gridfinity-converter-browser/desktop.png
```

The native test checks all four styles and STEP re-import with a curved source feature. Kernel cases include arbitrary rotation, sideways parts, partial selection, 3 × 2 arrays, missing cells, thin roofs and invalid meshes. Browser tests cover downloads, stale preview invalidation, responsive widths and format import/conversion. Published dated evidence is in `checks/`. Fixtures are temporary and must not be published.

References: [Gridfinity dimensions](https://github.com/Stu142/Gridfinity-Documentation), [Gridfinity Rebuilt](https://github.com/kennetek/gridfinity-rebuilt-openscad), [Replicad](https://github.com/sgenoud/replicad), [Manifold](https://github.com/elalish/manifold). Dependencies and hashes are recorded in `provenance.json`; vendored licenses are retained. Manifold and Three core are shared with the existing shelf/foot tools.

## UI review · 2026-10-20

The review reduced the initial settings shown, added persistent workflow navigation and status, exposed selection counts and CAD/mesh output types, and separated foot selection overlays from the converted preview. Mobile conversion returns to the preview and offers an export shortcut. The persistent Convert feet action becomes Export files after successful conversion. Keyboard-visible focus styles and 44 px foot-selection targets are retained. Browser checks cover step anchor clearance, disabled-action guidance, stale previews, downloads and widths of 320, 390, 768 and 1600 px; see `checks/ux-browser.json`.

Conversion validates only the active replacement settings. Unapplied manual grid corrections do not block it. Invalid values open their settings group and show a status error. The upload regression covers a separate STL fixture; reconversion from hardware feet to plain feet is covered by the cavity-preservation regression.

## Hollow-bin regression

The attachment probe uses the actual replacement profile across a 0.02 mm seam band, with at least 1 mm² equivalent contact area, followed by the connected-solid check. It no longer assumes the center of a bin is solid. `check-hollow-bin.mjs input.stl` validates all four styles on the privately supplied thin-floor fixture; no uploaded geometry is included in the published site. Native CAD tests include a generated hollow bin. Browser evidence confirms upload, detection, conversion and reporting of fitted 3.9 mm screw depth with a 0.8 mm roof.

## Import and state audit · 2026-10-20

Boundary shells are grouped into material bodies before union: inward-facing enclosed cavity walls remain voids, rather than being unioned as independent parts. Containment is checked geometrically; uncontained inward shells are rejected. Tests cover cavities, material islands inside cavities, separate hollow bodies, reconversion and native STEP cavity preservation. Hardware labels require material around the hole, so a hollow interior is not labeled as screw holes. The file picker can reload the same file; newly added cells use the applied grid origin, and pending origin edits must be applied first. Regenerate older conversions whose inputs contained enclosed cavities. These regressions do not establish correctness for every damaged or nonstandard model.


## Public-model audit · 2026-10-20

The sample includes public STL tool holders and bins, a 3MF bin, three STEP parts, and nonstandard/female negative cases. Five tool holders were sampled with seed 20261020; other files were chosen for format and geometry coverage. Source URLs, immutable revisions, SHA-256 hashes, conversion reports and independent export checks are recorded in [checks/internet-models.json](checks/internet-models.json). The original community model files are not redistributed here.

Run `AUDIT_MANIFEST=manifest.json node scripts/gridfinity-converter/check-internet-models.mjs public results.json` with a manifest containing local `path` entries and source metadata. Each detected part is tested with plain and magnet/screw feet at zero adjustment, and plain feet at −0.50 and +0.20 mm. Earlier archived audit reports used the former +0.50 mm limit. `check-internet-exports.py <artifact-directory>` independently checks the saved STLs with trimesh. This is a varied sample, not a statistical compatibility guarantee.

The audit found a STEP serialization defect: valid in-memory geometry could fail exact CAD validation after export and re-import. The earlier generic export path omitted optional surface pcurves while retaining 3D curves and CAD surfaces. The current dedicated verifier preserves writer pcurves and parameter ranges, as described below. Both export coordinate variants are reopened and checked for exact validity, one solid, volume and bounds before downloads are enabled. This follows OpenCascade's [STEP surface-curve export option](https://github.com/Open-Cascade-SAS/OCCT/blob/master/dox/user_guides/step/step.md). The validation thresholds are unchanged.

Audit outcome: 10 of 15 public models converted in all four configurations (40 successful STL exports, plus four independently validated STEP exports). A 47 mm bin, half-width bin and female baseplate had no automatic matches. Two STEP inputs passed standard but failed exact CAD checks in both the browser kernel and separate OpenCascade installation. These remain unsupported. Existing rotated STEP/BREP fixtures also fail exact STEP re-import; the new export guard blocks them. This stricter check reduces native export coverage where earlier versions could offer an invalid file.

## Import progress and additional public-model audit

The workflow displays five numbered STEP/BREP import stages, completed-stage progress, elapsed time and time in the current operation. Stages are not a time percentage: individual CAD calls do not expose a continuous percentage. After parsing, progress reports actual CAD faces, preview attempts and triangle counts. CAD import stages time out after three minutes without a stage update; cancellation terminates the worker. Native conversion remains cancellable and reports numbered curve-repair and preservation subchecks. Preview generation starts at 0.025 mm and adapts automatically if necessary, retaining original STEP/BREP bytes for native conversion. The native preview reader parses once and reuses that body for mesh retries. It copies only accepted position/index buffers, omitting unused normals and face tables. Adaptive retries skip levels unlikely to fit. IGES retains the legacy importer. Preview deviation is shown under units and source dimensions; mesh export deviation is recorded separately. Native CAD surfaces are not simplified by preview adaptation.

[Additional 24-file audit](checks/internet-models-2.json): seven detected mesh models passed all six variants (42 conversions). Three CAD variants passed across two source models; four native variants were blocked by strict STEP round-trip validation. Two source models exceeded conversion time budgets, with remaining variants unattempted. Fourteen sources had no selected standard male feet, including 50 mm trays and female grids. These counts do not include the derived assembly regression, which verifies that a valid selected bin can convert despite an unrelated invalid lid; selecting the invalid lid remains rejected. Sources, hashes, attempts and failure messages are retained in the report. Community input models are not redistributed here.

`CAD_TEST_FILE=/path/to/Gridfinity-Sample-Size.step node scripts/gridfinity-converter/check-loading.mjs public /tmp/loading-check` exercises loading visibility and adaptive CAD import with a deliberately reduced 2,000-triangle preview budget. This test does not establish performance for every large STEP file or Windows browser.

## Native CAD consistency fixes

Native replacement coordinates are rounded to the existing 0.00001 mm boolean tolerance before construction. This removes float32 detection noise at nominally coincident edges; it does not round source CAD surfaces. The conversion report records the coordinate resolution and largest adjustment (at most 0.000005 mm). [The formerly failing public STEP matrix](checks/native-coordinate-models.json) now passes all four styles at zero fit plus both plain fit endpoints. Rotated STEP and BREP regression fixtures now also produce strictly validated exports, superseding the export rejections in earlier audits.

If an imported solid fails exact curve consistency checks, the native path tries OpenCascade SameParameter reconstruction of its 2D edge parameter curves against the existing 3D curves and surfaces. Acceptance still requires exact BREP validity, unchanged bounds within 0.00001 mm, unchanged volume within the preservation tolerance, and no increase in maximum edge/vertex tolerance beyond the existing value or 0.00001 mm. The report records any repair and measured changes. An open native shell remains rejected. Original input files are never overwritten.

Unchanged CAD shapes reuse their measured volume, including rigid orientation changes. Curve repair invalidates that cached measurement; reopened STEP exports are measured independently. Native scaling retains the scaled shape, covered by an inch-unit BREP regression. STEP export prefers preserved surface curves for repaired imports, and otherwise starts with reconstructed surface curves. If the first representation fails validation, the alternate representation is tried. Every offered file must still pass the same exact solid, bounds and volume checks; the report records the selected representation separately for both orientations.

If neither STEP representation passes, native BREP serialization is attempted for both coordinate poses. It must pass the same exact validity, single-solid, bounds and volume checks after reopening. A rejected STEP is never offered as a download. The report distinguishes `stepRoundTripValid` from `brepRoundTripValid` and retains the STEP failure reason. The regression deliberately substitutes a different solid during STEP serialization and checks that the correct BREP fallback is preserved.


Native booleans now configure an empty operation and build once. OCCT's two-shape constructor already builds; following it with `Build()` repeated the operation. The requested 0.00001 mm tolerance is set before the single build. Native validity and preservation checks remain in place.

Native booleans preserve their input topology with non-destructive mode. Hardware roof checks intersect the converted body with an exact CAD box enclosing every roof cylinder, then test the cylinders against that local solid. Since each cylinder is contained in the box, the missing-material test is unchanged. This avoids repeated whole-body operations on decorative surfaces. Roof checks report their current count, and the native regression includes a cavity-breakthrough rejection. Worker failures retain the operation stage and original stack.

## Drawing cost

The viewer renders on demand: camera movement and damping, model changes, foot selection, section controls and resizing request frames. Static views stop drawing, and hidden tabs suspend drawing until visible again. Browser tests count WebGL draw calls to verify idle behavior and redraws after camera and section changes. This changes neither detection geometry nor native replacement/export geometry. Complex CAD repair, booleans and export validation can still take several minutes.


## Retained CAD and local replacement · 2026-10-20

The browser retains the prepared original CAD source across successful conversions. Style, fit, orientation and unit changes start from that source, never from the previous conversion. Temporary native shapes are released after each operation. File replacement, worker failure and hard cancellation dispose of the retained worker. A clean cooperative cancellation keeps the prepared source for retry. There is no conversion-count expiry.

One shared native edit region supplies attachment and hardware-roof checks. Replacement assembly uses `(source \ (cuts union holes)) union (feet \ holes)`, avoiding repeated full-body hole operations. Exact result validity, preserved-boundary checks, actual final-body clipping and outside-region material differences remain required. Unsupported boundary comparisons fall back to full solid differences. A separate worker independently reopens and validates the BREP while the main worker completes its checks; either failure blocks publication.

Unchanged display faces reuse their original tessellation. The display mesh is separate from native geometry and from the finer STL/3MF mesh generated on download. STEP translation and original-pose exports are prepared when requested. A STEP edge preview can appear before the full solid is available. Progress represents completed stages and actual counts, not an estimated time percentage.

The viewer follows the render skill recipe: ivory background, teal structure, orange selection/added material, three-band derivative lighting, welded-normal silhouettes and 30-degree feature edges. It draws on demand without a floor grid. Presentation adjacency is prepared in a separate worker; source coordinates and export geometry are unchanged. The optional open clipping view is explicitly labeled and is not a capped engineering section.

Regression coverage includes all four styles, fit endpoints, partial selections, shifted centers, hollow parts, screw-depth fitting, roof rejection, cavities and export validation. Repeated-source tests cover seven conversions, units, orientation, remeshing fallback and recovery after an error. Three consecutive conversions of the large private STEP fixture passed; repeated magnet volumes matched exactly and every run reused the prepared source and unchanged display faces. No private model files are distributed. An earlier Windows Firefox magnet run took 37.2 seconds from Convert to ready; this is one measurement, not a timing guarantee or a sub-15-second claim.

## Threaded native CAD and ownership · 2026-10-20

On supported secure browsers, a converter-scoped, network-only service worker adds isolation headers to same-origin GET responses and enables cross-origin isolation before model selection. The CAD kernel then uses at most four threads per worker for exact validation, supported booleans and tessellation. The first visit may reload once before the picker becomes available. Unsupported browsers or failed initialization fall back to the single-thread kernel. Initialization failure terminates any partially created thread pool. The service worker does not cache responses or store model files.

Native wrappers returned by OCCT builders and explorers are released after creating the owning shape wrapper. Temporary construction shapes are retired before whole-result validation, while the prepared source and required edit-region shapes remain retained. Reports include the selected kernel, thread count, validation-stage timings and WASM linear-memory capacity; capacity is not a measurement of live allocations. These changes retain exact geometric checks and independent BREP reopening.

A four-thread conversion of the private pencil-cup fixture passed exact native and reopened BREP checks with the same measured volume as the single-thread run. On the development host, conversion took 91.7 seconds versus 129.1 seconds for the single-thread baseline; these are individual, host-specific measurements, not a Windows performance guarantee. Chromium browser tests cover isolation startup, bounded fallback, thread cleanup and parallel/serial boolean equivalence. Firefox passed isolation and threaded exact-kernel checks. Those earlier measurements preceded the dedicated STEP verifier described below. Validated BREP remains available when STEP translation fails strict reopening checks.

Prepared sources also retain one exact local clip and one bounds certificate. Cache keys include the source placement and units, plus the exact clip or detection bounds. Changing those inputs recomputes the affected check; changing replacement style can reuse the unchanged source geometry. All final-body, preservation and export checks still run. Tests cover scale and rotation changes, failed conversions, and preservation of the canonical source.

Native mesh reads interpret C++ pointer returns as unsigned wasm32 addresses and validate alignment and buffer ranges before copying. This fixes negative byte offsets when a retained worker's allocations cross 2 GiB; it does not remove the kernel's memory ceiling. Both ordinary and shared buffers are tested across that boundary. File selection remains disabled until application handlers are installed, including when application loading is delayed.


## Dedicated STEP verification

App-generated STEP is independently reopened with a dedicated reader that preserves the writer's pcurves and parameter intervals. Imported models still use the standard CAD reader. The export reader requires valid source geometry, positive single-solid volume, and consistent edge parameterization; the reopened STEP must pass strict validity, volume, bounds and per-kind tolerance ceilings.

On the threaded export path, selective processing omits two later SameParameter passes and the redundant orientation repair while retaining the earlier exact edge normalization and wire/face repairs. The pencil-cup readback is byte-for-byte identical to the independently audited full-repair readback. A rejected selective result is retried with a fresh reader and full repair. Native memory traps are terminal and never trigger another attempt on the damaged kernel. Single-thread export retains full repair.

A private source certificate binds previously verified validity and signed volume to the exact BREP bytes and selected kernel build. Proper rigid orientation changes can reuse these two metrics; bounds are recomputed in the requested pose. Missing or mismatched certificates retain the original checks. Imported metadata cannot supply this certificate.

Exact source bounds can run in a separate worker while the STEP writer and reader run. Replies are checked against source-byte hash, pose and kernel identity before acceptance. Invalid replies or worker errors fall back to the local exact calculation. Cancellation terminates the bounds worker and its thread descendants. Final reopened geometry is still checked independently.

The native binding generator now releases owning wrappers for classes that declare both ordinary and placement delete. Corrected threaded model and verifier kernels use mimalloc; reports distinguish linear-memory capacity from current-thread allocation statistics. Ten consecutive Windows conversions passed after the ownership fix without the former multi-gigabyte capacity growth.

Already-valid sources with consistent edge parameters retain their original curves; invalid or inconsistent sources still use guarded preparation. The dedicated STEP writer uses 17 significant digits, preserving values that previously accumulated enough decimal-rounding error to trip the tolerance gate. Trimmed ring-torus bounds use analytic extrema with residual checks, an outward numerical allowance and generic fallback; the documented error budget depends on the pinned musl implementation.

Earlier build `native-step-20261021-2` matched private candidate 015800. The following measurements belong to that build, not the current candidate. Three fresh Windows Ryzen 7 5800X3D / Edge 155 flows and a separate ten-swap load passed: preview 0.58–0.66 seconds, preparation 17.55–18.12 seconds, conversion 15.40–18.79 seconds, and all nine STEP exports 16.41–17.88 seconds. Every STEP export passed independent reopening checks. Selection to converted remains about 36 seconds, with STEP export afterward. These are measurements on that machine, not a universal timing guarantee.

Export reports state the unchanged acceptance rules: strict validity and one solid, per-kind tolerance no greater than source plus 1e-12 mm, bounds difference at most 1e-5 mm, and volume difference at most max(0.001 mm³, source volume × 1e-8). These are numerical checks with explicit allowances, not exact arithmetic. Single/full and threaded/selective readers produce the same independently audited cup BREP.

Positive fit is limited to +0.20 mm per side; negative fit remains available to −0.50 mm. The supplied 3×4 solid passed all four styles at zero fit, including STEP exports. Its positive-fit variants passed native conversion and BREP validation but STEP translation was rejected by tolerance-preservation checks at +0.05, +0.10 and +0.20 mm. The UI exposes the rejection reason and retains validated BREP export.

### Additional private qualification

Private build `fast-export-20261021-014000` completed three fresh Windows conversions in 18.31–18.53 seconds and all six STEP exports in 17.90–19.13 seconds. Preparation completed 17.31–17.85 seconds after selection. The complete selection-to-converted path remains about 36 seconds, with STEP export afterward; these phase timings do not meet a sub-20-second complete-workflow target. Cancelling at 4.05 seconds allowed retry without choosing the file again, but retry took 35.04 seconds because native source preparation repeated.

The earlier 011800 ten-swap run retained flat 1866 MB WASM capacity while current-thread allocated-block statistics increased 60.5→99.6 MB. This limited allocator statistic is not total-process live memory. The monotonic residue remains unexplained, so the run does not establish indefinite bounded memory. These results belong to separate private builds and do not qualify a later candidate automatically.

The already-valid source path differs from the older repaired source by about 0.00064 mm³ because it preserves the original valid geometry instead of applying an unnecessary parameter reconstruction. Preservation and STEP checks use the new validated source as their reference. No byte-identical-to-the-old-result claim or relaxed validation threshold follows from that change.


### Export startup and cancellation

One unused export verifier is warmed during conversion and consumed once. Conversion activity renews its 60-second idle lifetime. Its bounds-worker module is also preloaded without model data or a second CAD kernel. A cold export starts its main kernel and bounds-worker startup concurrently. Source-bounds work acknowledges startup before synchronous parent work begins; its reply still requires matching source bytes, pose and kernel. A failed or late startup falls back to local bounds without dropping checks. Leaving the page cancels pending export promises and retires owned workers.

Cancelling a prepared native conversion requests cancellation at explicit operation boundaries. A clean acknowledgement preserves the prepared CAD and settings for immediate retry. Pending validation tasks are settled and their workers retired before that acknowledgement. Native errors retain priority over cancellation; an eight-second acknowledgement timeout terminates the worker and retains the input/settings for a fresh preparation on retry. No partly checked conversion is published. The earlier 014000 hard-cancellation recovery took 35.04 seconds and is not the timing of the cooperative path. In the 015800 ten-swap run, capacity was 1734 MB then flat at 1866 MB, while current-thread live allocation grew from 60.3 to 99.4 MB. Remaining allocation residue is unresolved.


### Build native-step-20261021-3

This build matches private build `fast-export-20261021-025000`. On Windows 11 / Ryzen 7 5800X3D / Edge 155, seven loads completed 17 conversions and 11 strict STEP exports with no geometry failures. Five fresh flows showed initial preview in 0.55–0.68 seconds and preparation in 17.19–19.31 seconds. Four fresh conversions took about 17.9–18.2 seconds; one took 21.06 seconds on a quiet host, so reliable sub-20-second conversion is not established. After the first conversion, repeated swaps took 13.8–15.9 seconds. All STEP exports took 14.9–19.8 seconds, including an 18.30-second cold export after 70 seconds idle. Clean cancellation completed in 1.05 seconds and retained-source retry took 15.62 seconds. These are harness wall times; the raw event audit uses slightly earlier UI endpoints and records the slow conversion as 21.040 seconds. Selection to converted was about 35–41 seconds, followed by STEP export. Local checks additionally cover STL/BREP exports, page-hide export cancellation with worker cleanup, and the actual pencil cup through the public-form browser app. Detailed evidence is in `checks/windows-native-step-3.json`; these measurements do not guarantee timing on other hardware or under arbitrary load.

The threaded model kernel can create an independent topology copy for the primary strict result check while sharing immutable exact curves and surfaces. It retains planar pcurves that an identity transformation can omit. The extra copy cost is included in `primaryExactValidation.elapsedMS`, with the selected method and copy time reported separately. Export serialization and the independently reopened BREP still use the original deep snapshot. Single-thread and unsupported inputs retain the existing validation path. Polygon-only faces/edges, free edges without face context, and shapes without faces are rejected by the optimization and fall back; native failures are not treated as unsupported geometry. Native and WASM fixtures check source invariance and invalid-input behavior.

An unchanged retained source also caches signed volume for its exact scale and placement. Different units, orientation, translation, document or body recompute the measurement; bounds and volume-match gates still run. Matched operation sequences produced byte-identical exports in the cache audit. Temporary Replicad loft and curve-to-edge handles are released explicitly. The limited current-thread allocation residue observed over repeated swaps remains unresolved; these changes do not establish indefinite bounded memory.

Source patches, focused tests, artifact hashes and build inputs are in `scripts/gridfinity-converter/native-kernel/fast-export-v7`. Reconstruction still relies on pinned external binding/object caches; a clean-cache rebuild has not been demonstrated. No private model or derived CAD file is included.

Release `native-step-20261021-4` adds native preparation-trap recovery: the failed worker is discarded, the original input and settings stay available, and retry reparses with a fresh kernel. A conversion already queued behind failed preparation is rejected before it can use that kernel. Ordinary preparation errors keep their existing retry behavior. Native traps during preservation also propagate instead of attempting additional Boolean checks. Cached display faces avoid unused transform reads; native bodies and export checks are unchanged.

The combined changes passed 33 UI assertions, small-model native conversion and STL/BREP/STEP export, and injected idle/queued preparation-trap recovery with strict STEP after retry. The full pencil-cup fixture also passed native conversion, closed-mesh checks and STL/BREP/STEP export; outside-region change was zero and its BREP was byte-identical to the qualified release-3 result. [Release-4 correctness evidence](checks/recovery-native-step-4.json) records the input/output hashes and unchanged acceptance gates. Injection hooks are test-only and absent from the release. The latest Windows timing qualification above remains for release 3; this release does not claim the under-20-second goal has been achieved. The model remains on four threads.


### Build native-step-20261021-5

The four-thread model now checks its existing independent deep snapshot concurrently with preservation work. Each operation uses two participants; the pool returns to four only after explicit nonblocking pthread retirement. Primary success, independent BREP validation and preservation checks must all pass before publishing a conversion. Cancellation waits for the active primary job to retire before acknowledging clean cancellation; prepared CAD remains available for retry. Unsupported and single-thread configurations retain sequential validation. Native traps discard the worker.

Seven Windows 11 / Ryzen 7 5800X3D / Edge 155 loads completed 17 conversions and 11 independently validated STEP exports. Five fresh conversions took 17.18–17.43 seconds; all measured conversions took 13.33–17.60 seconds. STEP exports took 15.06–18.54 seconds, including a cold export after 70 seconds idle. Preparation took about 17.4–18.6 seconds. Selection through conversion still takes about 35 seconds, with STEP afterward. These measurements qualify this part and host, not arbitrary hardware or system load. One concurrent primary check took 7 seconds without extending the conversion beyond 15.39 seconds.

Cancellation immediately after the primary job started acknowledged cleanly after 3.01 seconds, following pthread retirement. Retry took 14.89 seconds and strict STEP passed. Model capacity after cleanup remained 1866 MiB; current-thread allocation residue remains an open measurement issue. Local tests cover real main-worker and background pthread traps, ordinary errors and clean cancellation. The full-cup BREP remains byte-identical to release 4. See [Windows evidence](checks/windows-native-step-5.json) and [correctness evidence](checks/primary-overlap-native-step-5.json). Native source, build inputs and audit tests are in `scripts/gridfinity-converter/native-kernel/primary-overlap`; reconstruction requires the documented external object cache.
