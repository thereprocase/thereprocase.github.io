# Gridfinity male base converter

Local browser tool for replacing male feet on an existing solid. Detects orientation, the standard foot profile and occupied cells on a fixed 42 mm grid. Displays the array extent and occupied-cell count. Missing cells are not filled automatically. The Convert feet button is always available in the persistent workflow bar once feet are selected; no confirmation checkbox is required.

Styles: plain, 6 × 2 mm magnets, cylindrical M3 holes, or both. Default profile widths are 35.6 / 37.2 / 37.2 / 41.5 mm at Z 0 / 0.8 / 2.6 / 4.75 mm, with corner radii 0.8 / 1.6 / 1.6 / 3.75 mm. Hardware centers are ±13 mm. Magnet pockets default to diameter 6.5 mm and depth 2.4 mm; screw holes to diameter 3 mm and a requested maximum depth of 6 mm. The UI defaults to fitting screw depth within existing material in 0.1 mm steps, with a 2 mm minimum; Exact depth keeps the requested depth and refuses insufficient roofs. The report records requested and actual depths. A minimum material roof is checked before cutting holes.

## Representations and formats

- STEP/STP and BREP/BRP: OpenCascade imports the original boundary representation, performs native CAD booleans, checks validity and exports STEP. If STEP translation fails validation, native BREP is offered only after independently reopening and validating it. The download button and report identify the actual format. Rounded profiles and bores are CAD surfaces. Original surfaces outside the edit regions remain CAD surfaces. Tessellation is only used for detection, preview and optional mesh exports (starting at 0.01 mm deflection; automatically adapted to browser capacity, with actual deviation recorded). Native CAD feature history is not reconstructed.
- STL, 3MF, OBJ, PLY, OFF, AMF, glTF/GLB, COLLADA and FBX: mesh operations with Manifold. Geometry outside the allowed edit masks is preserved within the stated volume tolerance; no global remeshing or smoothing. Face indexing/triangulation can change during boolean operations. Exports are STL and millimetre 3MF.
- IGES: currently imported as a tessellated mesh (starting at 0.025 mm deflection, automatically adapted for large previews). Export STEP from the source CAD application when native preservation is required.
- Unit metadata and static scene/component transforms are applied where available. STL/OBJ/PLY/OFF default to mm; FBX requires the user to choose units. Companion buffers must be selected with glTF files. Skinned poses must be baked.
- Disconnected parts are offered separately. Only the selected part is converted and exported. Colors, textures, original assembly structure and slicer settings are not preserved. Proprietary project files need an interchange export first.

## Geometry checks

The detector samples cross-sections at 0.2, 1.6 and 4.5 mm, estimates base orientation and yaw, checks the expanding rounded-square profile, and fits a common grid phase. Accepted centers are snapped to exact 42 mm spacing. A single cell establishes a profile match, not an independently measured pitch. Off-grid matches are not automatically selected. Manual integer cells and a common origin correction are available.

Conversion removes only selected foot regions, builds complete replacement feet, checks overlap across the full rounded foot profile (including perimeter walls of hollow bins) and hole roofs, then checks one connected solid. Mesh edge incidence and winding are checked before export. Native STEP/BREP additionally passes OpenCascade's geometric/topological validity analyzer. Both paths measure symmetric material change outside the union of replacement and requested hole regions; export is blocked above max(0.001 mm³, original volume × 1e-8). Tiny float32 normalization is bounded and recorded. These checks are digital geometry evidence, not a guarantee of physical fit or print strength.

Open/inconsistently wound inputs are rejected; coincident seam vertices are welded, but missing surfaces are not invented. Old cavities above the replacement seam can remain enclosed. Female sockets, baseplates and racks are out of scope. Processing limits: 50 MB per model, 1 million triangles for mesh input, 128 feet, 64 separate solids. Cancellation terminates workers; reload the model to resume.

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

Run `AUDIT_MANIFEST=manifest.json node scripts/gridfinity-converter/check-internet-models.mjs public results.json` with a manifest containing local `path` entries and source metadata. Each detected part is tested with plain and magnet/screw feet at zero adjustment, and plain feet at −0.50 and +0.50 mm. `check-internet-exports.py <artifact-directory>` independently checks the saved STLs with trimesh. This is a varied sample, not a statistical compatibility guarantee.

The audit found a STEP serialization defect: valid in-memory geometry could fail exact CAD validation after export and re-import. Native STEP exports now omit optional surface pcurves while retaining 3D curves and CAD surfaces; readers reconstruct the pcurves. Both export coordinate variants are reopened and checked for exact validity, one solid, volume and bounds before downloads are enabled. This follows OpenCascade's [STEP surface-curve export option](https://github.com/Open-Cascade-SAS/OCCT/blob/master/dox/user_guides/step/step.md). The validation thresholds are unchanged.

Audit outcome: 10 of 15 public models converted in all four configurations (40 successful STL exports, plus four independently validated STEP exports). A 47 mm bin, half-width bin and female baseplate had no automatic matches. Two STEP inputs passed standard but failed exact CAD checks in both the browser kernel and separate OpenCascade installation. These remain unsupported. Existing rotated STEP/BREP fixtures also fail exact STEP re-import; the new export guard blocks them. This stricter check reduces native export coverage where earlier versions could offer an invalid file.

## Import progress and additional public-model audit

The workflow displays an indeterminate loading bar, elapsed time and the active import/conversion stage. The CAD engine does not expose a reliable percentage. CAD import stages time out after three minutes without a stage update; cancellation terminates the worker. Native conversion remains cancellable. Preview generation starts at 0.025 mm and adapts automatically if necessary, retaining original STEP/BREP bytes for native conversion. Compact typed geometry is transferred from the importer without copying the full CAD face/normal tables. Adaptive retries skip levels unlikely to fit. Preview deviation is shown under units and source dimensions; mesh export deviation is recorded separately. STEP surfaces are not simplified by preview adaptation.

[Additional 24-file audit](checks/internet-models-2.json): seven detected mesh models passed all six variants (42 conversions). Three CAD variants passed across two source models; four native variants were blocked by strict STEP round-trip validation. Two source models exceeded conversion time budgets, with remaining variants unattempted. Fourteen sources had no selected standard male feet, including 50 mm trays and female grids. These counts do not include the derived assembly regression, which verifies that a valid selected bin can convert despite an unrelated invalid lid; selecting the invalid lid remains rejected. Sources, hashes, attempts and failure messages are retained in the report. Community input models are not redistributed here.

`CAD_TEST_FILE=/path/to/Gridfinity-Sample-Size.step node scripts/gridfinity-converter/check-loading.mjs public /tmp/loading-check` exercises loading visibility and adaptive CAD import with a deliberately reduced 2,000-triangle preview budget. This test does not establish performance for every large STEP file or Windows browser.

## Native CAD consistency fixes

Native replacement coordinates are rounded to the existing 0.00001 mm boolean tolerance before construction. This removes float32 detection noise at nominally coincident edges; it does not round source CAD surfaces. The conversion report records the coordinate resolution and largest adjustment (at most 0.000005 mm). [The formerly failing public STEP matrix](checks/native-coordinate-models.json) now passes all four styles at zero fit plus both plain fit endpoints. Rotated STEP and BREP regression fixtures now also produce strictly validated exports, superseding the export rejections in earlier audits.

If an imported solid fails exact curve consistency checks, the native path tries OpenCascade SameParameter reconstruction of its 2D edge parameter curves against the existing 3D curves and surfaces. Acceptance still requires exact BREP validity, unchanged bounds within 0.00001 mm, unchanged volume within the preservation tolerance, and no increase in maximum edge/vertex tolerance beyond the existing value or 0.00001 mm. The report records any repair and measured changes. An open native shell remains rejected. Original input files are never overwritten.

Unchanged CAD shapes reuse their measured volume, including rigid orientation changes. Curve repair invalidates that cached measurement; reopened STEP exports are measured independently. Native scaling retains the scaled shape, covered by an inch-unit BREP regression. STEP export prefers preserved surface curves for repaired imports, and otherwise starts with reconstructed surface curves. If the first representation fails validation, the alternate representation is tried. Every offered file must still pass the same exact solid, bounds and volume checks; the report records the selected representation separately for both orientations.

If neither STEP representation passes, native BREP serialization is attempted for both coordinate poses. It must pass the same exact validity, single-solid, bounds and volume checks after reopening. A rejected STEP is never offered as a download. The report distinguishes `stepRoundTripValid` from `brepRoundTripValid` and retains the STEP failure reason. The regression deliberately substitutes a different solid during STEP serialization and checks that the correct BREP fallback is preserved.

## Drawing cost

The viewer renders on demand: camera movement and damping, model changes, foot selection, section controls and resizing request frames. Static views stop drawing, and hidden tabs suspend drawing until visible again. Browser tests count WebGL draw calls to verify idle behavior and redraws after camera and section changes. This changes neither detection geometry nor native replacement/export geometry. Complex CAD repair, booleans and export validation can still take several minutes.
