# Shared Gridfinity browser components

## Workspace layout (2026-10-21)

`workspace-layout.css` and `workspace-layout.js` keep generation/conversion and geometry exports in a sticky action bar. Desktop settings scroll beside the viewer; mobile shortcuts jump between the same controls. Advanced settings and reference notes use native details elements. The helper opens collapsed ancestors for invalid form controls and anchor navigation. Existing control IDs and form associations are retained; geometry engines and file formats are unchanged.

Validation: `scripts/gridfinity/check-workspace-layout.mjs` captures 1366×768, 1920×1080, 2560×1440, 390×844 and 320×740. Run the generator runtime and converter browser checks after moving controls.
