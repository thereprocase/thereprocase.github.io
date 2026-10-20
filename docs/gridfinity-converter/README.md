# Gridfinity male base converter

Local browser tool for replacing male feet on an existing solid. Detects orientation, the standard foot profile and occupied cells on a fixed 42 mm grid. Displays the array extent and occupied-cell count. Missing cells are not filled automatically. The Convert feet button is always available in the persistent workflow bar once feet are selected; no confirmation checkbox is required.

Styles: plain, 6 × 2 mm magnets, cylindrical M3 holes, or both. Default profile widths are 35.6 / 37.2 / 37.2 / 41.5 mm at Z 0 / 0.8 / 2.6 / 4.75 mm, with corner radii 0.8 / 1.6 / 1.6 / 3.75 mm. Hardware centers are ±13 mm. Magnet pockets default to diameter 6.5 mm and depth 2.4 mm; screw holes to diameter 3 mm and depth 6 mm. A minimum material roof is checked before cutting holes.

## Representations and formats

- STEP/STP and BREP/BRP: OpenCascade imports the original boundary representation, performs native CAD booleans, checks validity and exports STEP. Rounded profiles and bores are CAD surfaces. Original surfaces outside the edit regions remain CAD surfaces. Tessellation is only used for detection, preview and optional mesh exports (0.01 mm deflection). Native CAD feature history is not reconstructed.
- STL, 3MF, OBJ, PLY, OFF, AMF, glTF/GLB, COLLADA and FBX: mesh operations with Manifold. Geometry outside the allowed edit masks is preserved within the stated volume tolerance; no global remeshing or smoothing. Face indexing/triangulation can change during boolean operations. Exports are STL and millimetre 3MF.
- IGES: currently imported as a tessellated mesh (0.025 mm deflection). Export STEP from the source CAD application when native preservation is required.
- Unit metadata and static scene/component transforms are applied where available. STL/OBJ/PLY/OFF default to mm; FBX requires the user to choose units. Companion buffers must be selected with glTF files. Skinned poses must be baked.
- Disconnected parts are offered separately. Only the selected part is converted and exported. Colors, textures, original assembly structure and slicer settings are not preserved. Proprietary project files need an interchange export first.

## Geometry checks

The detector samples cross-sections at 0.2, 1.6 and 4.5 mm, estimates base orientation and yaw, checks the expanding rounded-square profile, and fits a common grid phase. Accepted centers are snapped to exact 42 mm spacing. A single cell establishes a profile match, not an independently measured pitch. Off-grid matches are not automatically selected. Manual integer cells and a common origin correction are available.

Conversion removes only selected foot regions, builds complete replacement feet, checks seam attachment and hole roofs, then checks one connected solid. Mesh edge incidence and winding are checked before export. Native STEP/BREP additionally passes OpenCascade's geometric/topological validity analyzer. Both paths measure symmetric material change outside the union of replacement and requested hole regions; export is blocked above max(0.001 mm³, original volume × 1e-8). Tiny float32 normalization is bounded and recorded. These checks are digital geometry evidence, not a guarantee of physical fit or print strength.

Open/inconsistently wound inputs are rejected; coincident seam vertices are welded, but missing surfaces are not invented. Old cavities above the replacement seam can remain enclosed. Female sockets, baseplates and racks are out of scope. Processing limits: 50 MB per model, 1 million triangles, 128 feet, 64 separate solids. Cancellation terminates workers; reload the model to resume.

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

Conversion validates only the active replacement settings. Unapplied manual grid corrections do not block it. Invalid values open their settings group and show a status error. The upload regression covers a separate STL fixture; reconversion of the rotated/both export to plain still triggers the connected-solid guard and is rejected, rather than exported.
