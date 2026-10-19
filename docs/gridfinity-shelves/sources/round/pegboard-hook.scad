// Pegboard & SKÅDIS Accessory Generator for 3D printing
// https://mrvarity.com/apps/openscad/g/pegboard-hook/
//
// Hooks, double hooks, shelves with a lip, tool ring holders and bins for
// IKEA SKÅDIS boards (5 x 15 mm slots, 40 mm apart) and classic pegboard
// (1/4 in holes on a 1 in grid, or 6 mm holes on a 25 mm grid). The top tab
// drops into the board and hooks behind it, a straight peg one row lower
// stops the part from swinging, and an optional lock keeps it from being
// knocked off. Laid on its side for printing, so hooks need no supports.
//
// IKEA and SKÅDIS are trademarks of Inter IKEA Systems B.V., which is not
// affiliated with and does not endorse this generator.
//
// MIT License, (c) 2026 Eugene Vasenev / mrvarity.com

/* [Board] */
// Which board the accessory hangs on
board = "skadis"; // [skadis:IKEA SKÅDIS (5 x 15 mm slots), pegboard:Pegboard 1/4 in holes on 1 in grid, pegboard_metric:Pegboard 6 mm holes on 25 mm grid]
// Board thickness (mm). 0 = automatic: 5 for SKÅDIS and metric, 6.35 (1/4 in) for imperial pegboard
board_thickness = 0; // [0:0.5:10]
// Gap between the tabs and the board on each side (mm). Raise if the tabs are too tight
fit_clearance = 0.3; // [0.1:0.05:0.8]
// Lock: SKÅDIS gets a small plug that fills the slot above the hook; pegboard gets a snap-in lower pin
lock_peg = false;

/* [Item] */
// What to make
item = "hook"; // [hook:Single hook, double_hook:Double hook (two prongs), shelf:Shelf / tray with lip, ring_holder:Ring holder for tools, bin:Cup / bin]
// Width counted in slots or holes: the part gets a pair of tabs in each of them
width_units = 1; // [1:1:8]
// Thickness of the wall that rests on the board (mm)
back_thickness = 4; // [2:0.5:8]

/* [Hook] */
// How far the hook reaches out from the board (mm)
hook_reach = 45; // [10:1:150]
// Height of the upturned tip at the end of the hook (mm, 0 = straight)
hook_tip_height = 12; // [0:1:40]
// Thickness of the hook arm, top to bottom (mm)
hook_thickness = 7; // [4:0.5:15]
// Width of each hook prong (mm)
hook_width = 10; // [4:1:40]
// Gap between the two prongs of a double hook (mm)
prong_gap = 20; // [5:1:100]

/* [Shelf and bin] */
// Depth from the board to the front edge (mm)
tray_depth = 50; // [15:1:200]
// Height of the front lip of a shelf (mm)
lip_height = 10; // [0:1:60]
// Height of a cup / bin (mm)
bin_height = 45; // [10:1:150]
// Wall and floor thickness (mm)
wall_thickness = 2; // [1.2:0.1:5]
// Close the ends of a shelf with side walls
end_walls = true;

/* [Ring holder] */
// Diameter of each hole (mm)
hole_diameter = 8; // [3:0.5:40]
// Number of holes
hole_count = 6; // [1:1:20]
// Material between neighbouring holes (mm)
hole_spacing = 4; // [1.5:0.5:20]
// Thickness of the plate with the holes (mm)
ring_thickness = 6; // [3:0.5:15]

/* [Printing] */
// Lay the part on its side for printing (strong tabs, hooks need no supports). Off = as it hangs
lay_on_side = true;

/* [Hidden] */
$fn = 40;
eps = 0.01;
skadis = board == "skadis";
metric = board == "pegboard_metric";
BT = board_thickness > 0 ? board_thickness : (board == "pegboard" ? 6.35 : 5);
fit = fit_clearance;
c = 2 * fit;                         // clearance through the board thickness
// SKÅDIS: 5 x 15 mm slots, 40 mm apart in a row, rows 20 mm apart and
// offset by 20 mm, so the slot straight below is 40 mm down
SW = 5;  SH = 15;
HD = metric ? 6 : 6.35;              // pegboard hole diameter
PITCH = skadis ? 40 : (metric ? 25 : 25.4);
VP = PITCH;                          // lower tab: next slot / hole straight below
PD = HD - 2 * fit;                   // pegboard pin diameter
// tab width across the board (pins get flats), kept to 1/8 mm so faces line up exactly
TW = round((skadis ? SW - 2 * fit : PD - 0.8) * 8) / 8;
BP = back_thickness;
AT = 6;                              // SKÅDIS hook tab height
LD = 6;                              // SKÅDIS hook drop behind the board
LT = 3.5;                            // SKÅDIS hook leg thickness
PH = 6;                              // SKÅDIS lower peg height
LU = 7;                              // pegboard L-pin rise behind the board
n = width_units;
span = (n - 1) * PITCH + TW;         // tabs flush with both side faces
WT = wall_thickness;
ring_gap = max(hole_spacing, 3);
W = round(8 * max(span,
        item == "hook" ? hook_width :
        item == "double_hook" ? 2 * hook_width + prong_gap :
        item == "ring_holder" ? hole_count * (hole_diameter + hole_spacing) + hole_spacing :
        30)) / 8;
x_b = -TW / 2;                       // left face, flush with the first tab
LOCK_LO = AT + 0.2;                  // SKÅDIS lock plug, fills the slot above the hook
LOCK_H = SH - AT - 0.6;
ztop = skadis ? (lock_peg ? SH + 3 : AT + 4) : ceil(PD / 2 + LU + 2);
zbot = skadis ? -VP - 3 : floor(-VP - PD / 2 - 3);
ring_depth = 2 * ring_gap + hole_diameter;
depth = item == "hook" || item == "double_hook" ? hook_reach :
        item == "ring_holder" ? ring_depth : tray_depth;

// Use coordinates: board front face at y = 0, the part sits at y > 0, x
// runs along the board, z up. Print coordinates come from this transform.
function P(p) = lay_on_side ? [-p[2], p[1], p[0] - x_b] : [p[0], p[1], p[2] - zbot];
module place() {
  if (lay_on_side) translate([0, 0, -x_b]) rotate([0, -90, 0]) children();
  else translate([0, 0, -zbot]) children();
}

// Dimension bubbles in the web editor: DIM|parameter|label|[x, y, z] anchor
xm = x_b + W / 2;
echo(str("DIM|width_units|", n, skadis ? (n == 1 ? " slot" : " slots") : (n == 1 ? " hole" : " holes"), "|",
         P([xm, BP, ztop])));
if (item == "hook" || item == "double_hook")
  echo(str("DIM|hook_reach|", hook_reach, " mm|", P([xm, BP + hook_reach, zbot + hook_thickness / 2])));
else if (item == "ring_holder")
  echo(str("DIM|hole_diameter|", hole_diameter, " mm|",
           P([x_b + W / hole_count / 2 + hole_diameter / 2, BP + ring_gap + hole_diameter / 2, zbot + ring_thickness])));
else
  echo(str("DIM|tray_depth|", tray_depth, " mm|",
           P([xm, BP + tray_depth, zbot + (item == "bin" ? bin_height : max(lip_height, WT)) / 2])));
if (item == "bin")
  echo(str("DIM|bin_height|", bin_height, " mm|", P([x_b + W, BP + tray_depth, zbot + bin_height / 2])));

// Extrude a 2D profile (u = y, v = z) along x from x0, w wide
module prof(x0, w) { translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(w) children(); }
module round_out(r) { offset(r = r) offset(delta = -r) children(); }

// ---------- tabs ----------
module skadis_hook_tab() {
  prof(-TW / 2, TW) round_out(0.8) polygon([
    [BP / 2, 0], [BP / 2, AT],
    [-(BT + c + LT), AT], [-(BT + c + LT), -LD + 1],
    [-(BT + c + LT) + 1, -LD], [-(BT + c) - 0.8, -LD], [-(BT + c), -LD + 0.8],
    [-(BT + c), 0]]);
}
module skadis_peg() {
  prof(-TW / 2, TW) round_out(0.6) polygon([
    [BP / 2, -VP], [-(BT + 2.5) + 1, -VP], [-(BT + 2.5), -VP + 1],
    [-(BT + 2.5), -VP + PH - 1], [-(BT + 2.5) + 1, -VP + PH], [BP / 2, -VP + PH]]);
}
module flats() { translate([-TW / 2, -50, -50]) cube([TW, 100, 100]); }
module peg_L_pin() {
  yl = -(BT + c + PD / 2);
  intersection() {
    union() {
      hull() {
        translate([0, BP / 2, 0]) rotate([90, 0, 0]) cylinder(h = eps, d = PD);
        translate([0, yl, 0]) sphere(d = PD);
      }
      hull() {
        translate([0, yl, 0]) sphere(d = PD);
        translate([0, yl, LU]) sphere(d = PD);
      }
    }
    flats();
  }
}
// Straight lower pin, turned from one profile; the lock version is split
// and has a barb that clicks behind the board
module peg_straight_pin() {
  L = BT + 2.5;
  r = PD / 2;
  pts = lock_peg
    ? [[0, -BP / 2], [r, -BP / 2], [r, BT + c], [r + 0.45, BT + c], [r - 0.3, L - 0.3], [r - 0.6, L], [0, L]]
    : [[0, -BP / 2], [r, -BP / 2], [r, L - 0.8], [r - 0.6, L], [0, L]];
  intersection() {
    difference() {
      rotate([90, 0, 0]) rotate_extrude() polygon(pts);
      if (lock_peg) translate([-PD, -L - 1, -0.6]) cube([2 * PD, L + 2, 1.2]);
    }
    flats();
  }
}
module tabs() {
  for (k = [0 : n - 1]) translate([k * PITCH, 0, 0]) {
    if (skadis) { skadis_hook_tab(); skadis_peg(); }
    else { peg_L_pin(); translate([0, 0, -VP]) peg_straight_pin(); }
  }
}
module lock_hole() {
  if (skadis && lock_peg) translate([-0.6, -eps, LOCK_LO - 0.1]) cube([3.0, BP + 2 * eps, LOCK_H + 0.2]);
}
// Separate plug, printed head down beside the part
module lock_plug() {
  cube([7, LOCK_H + 4, 1.6]);
  translate([(7 - 2.8) / 2, 2, 0]) cube([2.8, LOCK_H - 0.1, 1.6 + BP + BT + 1]);
}

// ---------- items ----------
module back_plate() { translate([x_b, 0, zbot]) cube([W, BP, ztop - zbot]); }

module hook_profile() {
  ht = hook_thickness;
  tt = max(4, ht * 0.8);
  g = min(hook_reach * 0.4, 15, ztop - zbot - ht - 2);
  union() {
    round_out(min(2, ht / 3)) union() {
      translate([0, zbot]) square([BP + hook_reach, ht]);
      if (hook_tip_height > 0) translate([BP + hook_reach - tt, zbot]) square([tt, ht + hook_tip_height]);
      polygon([[0, zbot + ht - eps], [BP + g, zbot + ht - eps], [0, zbot + ht + g]]);
    }
    // square where the arm meets the back so no slivers form along it
    translate([0, zbot]) square([BP + min(2, hook_reach / 2), ht]);
  }
}
module hooks() {
  if (item == "hook") prof(x_b, W) hook_profile();
  else {
    prof(x_b, hook_width) hook_profile();
    translate([x_b + W, 0, 0]) mirror([1, 0, 0]) prof(0, hook_width) hook_profile();
  }
}

module shelf() {
  ft = max(WT, 2.4);
  prof(x_b, W) round_out(min(0.9, WT / 2.5)) union() {
    translate([0, zbot]) square([BP + tray_depth, ft]);
    translate([BP + tray_depth - WT, zbot]) square([WT, max(ft, lip_height)]);
  }
  if (end_walls && lip_height > ft)
    for (m = [0, 1]) translate([x_b + m * W, 0, 0]) mirror([m, 0, 0]) prof(0, WT) round_out(min(0.9, WT / 2.5))
      polygon([[0, zbot], [BP + tray_depth, zbot], [BP + tray_depth, zbot + lip_height],
               [BP + min(tray_depth, 15), zbot + lip_height], [0, zbot + lip_height + min(tray_depth, 15)]]);
}

module hole2d(d) {
  // teardrop when printed on its side, so the top of the hole needs no support
  if (lay_on_side) union() { circle(d = d); rotate(-45) square(d / 2); }
  else circle(d = d);
}
module ring_holder() {
  rt = ring_thickness;
  difference() {
    prof(x_b, W) offset(r = -2) offset(r = 2) union() {
      translate([0, zbot]) square([BP + ring_depth, rt]);
      translate([-eps, zbot]) square([BP + eps, ztop - zbot]);
    }
    for (i = [0 : hole_count - 1])
      translate([x_b + (i + 0.5) * W / hole_count, BP + ring_gap + hole_diameter / 2, zbot - 1])
        linear_extrude(rt + 2) hole2d(hole_diameter);
  }
}

module bin() {
  r = min(4, tray_depth / 4, W / 4);
  difference() {
    translate([0, 0, zbot]) linear_extrude(bin_height) hull() {
      translate([x_b, 0]) square([W, eps]);
      translate([x_b + r, BP + tray_depth - r]) circle(r = r);
      translate([x_b + W - r, BP + tray_depth - r]) circle(r = r);
    }
    translate([0, 0, zbot + WT]) linear_extrude(bin_height) hull() {
      ri = max(0.5, r - WT);
      translate([x_b + WT, BP]) square([W - 2 * WT, eps]);
      translate([x_b + WT + ri, BP + tray_depth - WT - ri]) circle(r = ri);
      translate([x_b + W - WT - ri, BP + tray_depth - WT - ri]) circle(r = ri);
    }
  }
}

module part() {
  difference() {
    union() {
      back_plate();
      tabs();
      if (item == "hook" || item == "double_hook") hooks();
      else if (item == "shelf") shelf();
      else if (item == "ring_holder") ring_holder();
      else if (item == "bin") bin();
    }
    lock_hole();
  }
}

place() part();
if (skadis && lock_peg)
  translate(lay_on_side ? [-zbot + 8, 0, 0] : [x_b + W + 8, -ztop, 0]) lock_plug();
