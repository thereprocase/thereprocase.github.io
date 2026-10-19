// ikea-skadis.scad — parametric primitives for IKEA SKÅDIS pegboards.
// Author: John Mylchreest <jmylchreest@gmail.com>. MIT licensed.
//
// Peg coordinate convention: origin = slot centre on the panel front, in the
// LOCKED position. +X across the slot, +Y into the pegboard, +Z up. Peg
// geometry exists at Y ≥ -standoff, so the parent can be any thickness.
//
// Lock: 5 mm tab + 11.5 mm back retainer behind the panel (6.5 mm of tail
// below the slot, catching solid material). Insert with tab at slot top,
// drop 10 mm; lift 10 mm to remove. The retainer's top-front edge (the
// L-bend corner that sits behind the panel at the top of the slot) is
// chamfered slightly so it doesn't catch as the peg drops into the lock.

// Skadis is two interlocking 40 × 40 mm grids offset by (20, 20), giving a
// staggered grid: 40 mm horizontal pitch within a row, 20 mm vertical pitch
// between rows, odd rows offset by 20 mm in X.
SKADIS_SLOT_W      = 5.0;
SKADIS_SLOT_H      = 15.0;
SKADIS_PITCH_X     = 40.0;
SKADIS_PITCH_Y     = 20.0;
SKADIS_PITCH       = SKADIS_PITCH_X;   // legacy alias = horizontal pitch
SKADIS_PANEL_T     = 5.5;              // measured (IKEA 5.5, aftermarket 5.6)
SKADIS_PANEL_TOL   = 0.2;              // tab Y depth = panel_t + tol
SKADIS_DROP        = 10.0;             // = slot_h - tab_h, the lock travel

SKADIS_TAB_H       = 5.0;
SKADIS_RETAINER_H  = 11.5;
SKADIS_RETAINER_D  = 3.0;
SKADIS_RETAINER_TOP_CHAMFER = 0.3;
SKADIS_STANDOFF_W    = 10.0;
SKADIS_STANDOFF_H    = SKADIS_SLOT_H;

// `use<>` doesn't import top-level vars, so user code reads the constants
// through these accessors.
function skadis_slot_w()         = SKADIS_SLOT_W;
function skadis_slot_h()         = SKADIS_SLOT_H;
function skadis_pitch()          = SKADIS_PITCH;     // = horizontal pitch
function skadis_pitch_x()        = SKADIS_PITCH_X;
function skadis_pitch_y()        = SKADIS_PITCH_Y;
function skadis_panel_t()        = SKADIS_PANEL_T;
function skadis_panel_tol()      = SKADIS_PANEL_TOL;
function skadis_drop()           = SKADIS_DROP;
function skadis_tab_h()          = SKADIS_TAB_H;
function skadis_retainer_d()     = SKADIS_RETAINER_D;
function skadis_standoff_w()       = SKADIS_STANDOFF_W;
function skadis_standoff_h()       = SKADIS_STANDOFF_H;

// Z of the standoff centre relative to the peg's slot-centre origin. Use
// this when placing back-plate geometry that should sit behind the standoff.
function skadis_standoff_z_offset() = -SKADIS_SLOT_H + SKADIS_TAB_H;

// `anchor` picks which side of the grid sits at X=0; pegs grow away from it.
//   "left"   leftmost  peg at X=0, grid extends +X
//   "right"  rightmost peg at X=0, grid extends -X
//   "center" grid centred on X=0
function skadis_peg_x(i, cols, anchor="center") =
      (anchor == "left")   ? i * SKADIS_PITCH_X
    : (anchor == "right")  ? -(cols - 1 - i) * SKADIS_PITCH_X
    :                        (i - (cols - 1) / 2) * SKADIS_PITCH_X;

// `vanchor` does the same on Z: "bottom" | "top" | "center".
function skadis_peg_z(j, rows, vanchor="bottom") =
      (vanchor == "bottom") ? j * SKADIS_PITCH_Y
    : (vanchor == "top")    ? -(rows - 1 - j) * SKADIS_PITCH_Y
    :                         (j - (rows - 1) / 2) * SKADIS_PITCH_Y;

function skadis_grid_w(cols) = (cols - 1) * SKADIS_PITCH_X;
function skadis_grid_h(rows) = (rows - 1) * SKADIS_PITCH_Y;

function skadis_cols_for_width(w)  = max(1, floor(w / SKADIS_PITCH_X) + 1);
function skadis_rows_for_height(h) = max(1, floor(h / SKADIS_PITCH_Y) + 1);

// One peg. tol_w shrinks the tab/retainer in X (horizontal slot fit);
// tol_h shrinks the retainer in Z (insertion clearance). Any mechanical
// dimension can be overridden — undef = the library default.
//
// standoff = Y depth of the front-of-panel block bridging parent to pegboard.
// standoff_top_ext / standoff_bot_ext flare the parent-side end of the
// standoff so the block tapers from the peg-side rectangle to a taller
// rectangle at the parent. Both 0 (default) → rectangular block.
module skadis_peg(
    standoff         = 0,
    retainer         = false,
    tol_w            = 0.4,
    tol_h            = 0,
    standoff_top_ext = 0,
    standoff_bot_ext = 0,
    top_chamfer   = undef,
    top_chamfer_h = undef,
    slot_w     = undef, slot_h     = undef,
    panel_t    = undef, panel_tol  = undef,
    tab_h      = undef,
    ret_h      = undef, ret_d      = undef,
    standoff_w = undef, standoff_h = undef
) {
    _slot_w     = slot_w     == undef ? SKADIS_SLOT_W     : slot_w;
    _slot_h     = slot_h     == undef ? SKADIS_SLOT_H     : slot_h;
    _panel_t    = panel_t    == undef ? SKADIS_PANEL_T    : panel_t;
    _panel_tol  = panel_tol  == undef ? SKADIS_PANEL_TOL  : panel_tol;
    _tab_h      = tab_h      == undef ? SKADIS_TAB_H      : tab_h;
    _ret_h      = ret_h      == undef ? SKADIS_RETAINER_H : ret_h;
    _ret_d      = ret_d      == undef ? SKADIS_RETAINER_D : ret_d;
    _standoff_w = standoff_w == undef ? SKADIS_STANDOFF_W : standoff_w;
    _standoff_h = standoff_h == undef ? SKADIS_STANDOFF_H : standoff_h;
    _top_chamfer = top_chamfer == undef ? SKADIS_RETAINER_TOP_CHAMFER : top_chamfer;
    // Default chamfer height = tab_h, which equals the portion of the
    // retainer that sits inside the slot opening when locked. That lands
    // the chamfer-to-full-size transition exactly at the slot bottom
    // edge, where it's hidden by the panel material below the slot.
    _top_chamfer_h = top_chamfer_h == undef ? _tab_h : top_chamfer_h;

    _tab_w     = _slot_w - tol_w;
    _ret_w     = _tab_w;
    _eff_ret_h = _ret_h - tol_h;
    _eff_pan_t = _panel_t + _panel_tol;

    // Z layout in LOCKED position (origin at slot centre):
    //   tab fills slot bottom, retainer top-aligned with tab top, standoff
    //   top-aligned with tab top and extending DOWN by standoff_h.
    _tab_z0      = -_slot_h / 2;
    _tab_z1      = _tab_z0 + _tab_h;
    _ret_z0      = _tab_z1 - _eff_ret_h;
    _standoff_z0 = _tab_z1 - _standoff_h;

    union() {
        // Standoff block. Hull between a thin slice at the peg side (the peg
        // side never flares) and a parent-side slice that may be taller per
        // the top/bottom extensions, giving a tapered/bracket-style profile.
        if (standoff > 0) {
            hull() {
                translate([-_standoff_w / 2, -0.001, _standoff_z0])
                    cube([_standoff_w, 0.001, _standoff_h]);
                translate([-_standoff_w / 2, -standoff, _standoff_z0 - standoff_bot_ext])
                    cube([_standoff_w, 0.001,
                          _standoff_h + standoff_top_ext + standoff_bot_ext]);
            }
        }

        // In-slot horizontal shelf: tab + top of retainer fused into one
        // block that slides through the slot. The three "leading" top
        // edges (back, left, right) are chamfered at a constant slope
        // spanning the whole in-slot height so the chamfer-to-full
        // transition lands at the slot bottom edge (hidden by the panel
        // below). The top-FRONT edge stays sharp so the tab's front face
        // remains flush in the slot.
        _slot_bottom = _tab_z0;
        _in_slot_y_max = _eff_pan_t + _ret_d;
        _full_h = max(0, _tab_h - _top_chamfer_h);

        if (_full_h > 0)
            translate([-_ret_w / 2, 0, _slot_bottom])
                cube([_ret_w, _in_slot_y_max, _full_h]);

        if (_top_chamfer > 0 && _top_chamfer_h > 0)
            hull() {
                translate([-_ret_w / 2, 0, _slot_bottom + _full_h])
                    cube([_ret_w, _in_slot_y_max, 0.001]);
                translate([-_ret_w / 2 + _top_chamfer, 0, _tab_z1])
                    cube([_ret_w - 2 * _top_chamfer,
                          _in_slot_y_max - _top_chamfer,
                          0.001]);
            }
        else if (_top_chamfer_h > 0)
            translate([-_ret_w / 2, 0, _slot_bottom + _full_h])
                cube([_ret_w, _in_slot_y_max, _top_chamfer_h]);

        // Retainer tail: the part below the slot bottom that hangs behind
        // solid panel material and locks the peg in place. Plain block.
        if (_eff_ret_h - _tab_h > 0)
            translate([-_ret_w / 2, _eff_pan_t, _ret_z0])
                cube([_ret_w, _ret_d, _eff_ret_h - _tab_h]);

        // Friction bump on the front of the tab — resists accidental lift-out.
        if (retainer)
            translate([-_tab_w / 2, 0, _tab_z1])
                cube([_tab_w, _eff_pan_t * 0.6, 0.6]);
    }
}

// stagger_origin=0 offsets the odd rows; flip to 1 to offset the even ones.
function skadis_row_stagger(j, stagger = true, stagger_origin = 0) =
    !stagger ? 0
             : (((((j + stagger_origin) % 2) + 2) % 2) == 1) ? SKADIS_PITCH_X / 2 : 0;

function _pair_in(pairs, c, r) =
    len(pairs) == 0 ? false
                    : len([for (p = pairs) if (p[0] == c && p[1] == r) 1]) > 0;

// Staggered grid of pegs on the X-Z plane.
//   cols × rows                explicit counts
//   max_w / max_h              alternative — derive counts from a mm budget (wins if set)
//   include = [[c, r], ...]    only place these indices (whitelist)
//   skip    = [[c, r], ...]    drop these from the otherwise-full grid
//   stagger = false            disable the half-pitch row offset
module skadis_peg_grid(
    cols             = 2,
    rows             = 1,
    anchor           = "center",
    vanchor          = "bottom",
    max_w            = undef,
    max_h            = undef,
    include          = undef,
    skip             = [],
    stagger          = true,
    stagger_origin   = 0,
    standoff         = 0,
    standoff_top_ext = 0,
    standoff_bot_ext = 0,
    retainer         = false,
    tol_w            = 0.4,
    tol_h            = 0,
    top_chamfer      = undef,
    top_chamfer_h    = undef,
    // Mechanical overrides — forwarded to skadis_peg (undef = library default):
    slot_w = undef, slot_h = undef,
    panel_t = undef, panel_tol = undef,
    tab_h = undef, ret_h = undef, ret_d = undef,
    standoff_w = undef, standoff_h = undef
) {
    c = max_w == undef ? cols : skadis_cols_for_width(max_w);
    r = max_h == undef ? rows : skadis_rows_for_height(max_h);

    for (i = [0 : c - 1])
        for (j = [0 : r - 1]) {
            keep = include == undef ? !_pair_in(skip, i, j)
                                    :  _pair_in(include, i, j);
            if (keep) {
                stagger_dx = skadis_row_stagger(j, stagger, stagger_origin);
                translate([skadis_peg_x(i, c, anchor) + stagger_dx,
                           0,
                           skadis_peg_z(j, r, vanchor)])
                    skadis_peg(standoff = standoff, retainer = retainer,
                               tol_w = tol_w, tol_h = tol_h,
                               standoff_top_ext = standoff_top_ext,
                               standoff_bot_ext = standoff_bot_ext,
                               top_chamfer = top_chamfer,
                               top_chamfer_h = top_chamfer_h,
                               slot_w = slot_w, slot_h = slot_h,
                               panel_t = panel_t, panel_tol = panel_tol,
                               tab_h = tab_h, ret_h = ret_h, ret_d = ret_d,
                               standoff_w = standoff_w, standoff_h = standoff_h);
            }
        }
}

// Pegs at an explicit list of [col, row] indices, on the same staggered grid
// as skadis_peg_grid. Use for sparse / non-rectangular layouts.
module skadis_pegs_at(
    positions        = [[0, 0]],
    cols             = undef,
    rows             = undef,
    anchor           = "center",
    vanchor          = "bottom",
    stagger          = true,
    stagger_origin   = 0,
    standoff         = 0,
    standoff_top_ext = 0,
    standoff_bot_ext = 0,
    retainer         = false,
    tol_w            = 0.4,
    tol_h            = 0,
    top_chamfer      = undef,
    top_chamfer_h    = undef,
    // Mechanical overrides — forwarded to skadis_peg (undef = library default):
    slot_w = undef, slot_h = undef,
    panel_t = undef, panel_tol = undef,
    tab_h = undef, ret_h = undef, ret_d = undef,
    standoff_w = undef, standoff_h = undef
) {
    c = cols == undef ? max([for (p = positions) p[0]]) + 1 : cols;
    r = rows == undef ? max([for (p = positions) p[1]]) + 1 : rows;

    for (p = positions)
        translate([skadis_peg_x(p[0], c, anchor)
                       + skadis_row_stagger(p[1], stagger, stagger_origin),
                   0,
                   skadis_peg_z(p[1], r, vanchor)])
            skadis_peg(standoff = standoff, retainer = retainer,
                       tol_w = tol_w, tol_h = tol_h,
                       standoff_top_ext = standoff_top_ext,
                       standoff_bot_ext = standoff_bot_ext,
                       top_chamfer = top_chamfer,
                       top_chamfer_h = top_chamfer_h,
                       slot_w = slot_w, slot_h = slot_h,
                       panel_t = panel_t, panel_tol = panel_tol,
                       tab_h = tab_h, ret_h = ret_h, ret_d = ret_d,
                       standoff_w = standoff_w, standoff_h = standoff_h);
}

// Translucent pegboard slab for sanity-checking peg alignment. Anchor the
// grid on (anchor_x, anchor_z) — that point will be a slot centre and the
// rest of the staggered pattern follows. Use inside `if ($preview)`.
module skadis_pegboard_preview(
    width          = 240,
    height         = 240,
    anchor_x       = 0,    // (anchor_x, anchor_z) lands at a slot centre
    anchor_z       = 0,
    panel_t        = SKADIS_PANEL_T,
    stagger        = true,
    stagger_origin = 0
) {
    color("Tan", 0.30) difference() {
        translate([-width / 2, 0, -height / 2])
            cube([width, panel_t, height]);

        cols = ceil(width  / SKADIS_PITCH_X) + 2;
        rows = ceil(height / SKADIS_PITCH_Y) + 2;
        for (i = [-cols : cols])
            for (j = [-rows : rows]) {
                dx = skadis_row_stagger(j, stagger, stagger_origin);
                translate([anchor_x + i * SKADIS_PITCH_X + dx,
                           -0.1,
                           anchor_z + j * SKADIS_PITCH_Y])
                    linear_extrude(height = panel_t + 0.2)
                        offset(r = SKADIS_SLOT_W / 2)
                            offset(r = -SKADIS_SLOT_W / 2)
                                square([SKADIS_SLOT_W, SKADIS_SLOT_H], center = true);
            }
    }
}

// Demo — only runs when this file is opened directly, not when `use<>`d.
if ($preview) {
    // Full 4×3 staggered grid.
    color("SteelBlue") skadis_peg_grid(cols = 4, rows = 3,
                                       anchor = "center", vanchor = "center",
                                       standoff = 0);

    // Same footprint, but only the bottom-row corners (whitelist).
    color("OrangeRed") translate([240, 0, 0])
        skadis_peg_grid(cols = 4, rows = 3,
                        anchor = "center", vanchor = "center",
                        include = [[0, 0], [3, 0]],
                        standoff = 6);

    skadis_pegboard_preview(width = 200, height = 160);
    translate([240, 0, 0]) skadis_pegboard_preview(width = 200, height = 160);
}
