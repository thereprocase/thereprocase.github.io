import { meshData, foot } from './kernel.js?v=native-local-20261020-1';
export function demo(module) {
  const M = module.Manifold,
    owned = [],
    keep = (s) => (owned.push(s), s);
  try {
    const base = keep(
        M.cube([83.5, 41.5, 18]).translate([-41.75, -20.75, 4.75]),
      ),
      inside = keep(M.cube([79.5, 37.5, 20]).translate([-39.75, -18.75, 7])),
      left = keep(foot(module, -21)),
      right = keep(foot(module, 21));
    let bin = keep(
      keep(base.subtract(inside)).add(keep(M.union([left, right]))),
    );
    const holes = [];
    for (const dx of [-13, 13])
      for (const dy of [-13, 13])
        holes.push(
          keep(
            keep(M.cylinder(2.5, 3.25, 3.25, 64)).translate([
              -21 + dx,
              dy,
              -0.1,
            ]),
          ),
        );
    bin = keep(bin.subtract(keep(M.union(holes))));
    return meshData(bin);
  } finally {
    owned.reverse().forEach((s) => s.delete());
  }
}
