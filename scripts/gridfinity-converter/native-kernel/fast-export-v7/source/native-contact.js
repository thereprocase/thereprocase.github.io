/** Clip the detailed body once; each existing per-foot seam slice lies inside this band. */
export function clipNativeAttachmentBand({ cad, intersect, source, feet, bottom, height }) {
  if (!feet.length) throw Error('Select at least one foot before converting.');
  const margin = 0.01;
  const band = cad.makeBox(
    [Math.min(...feet.map((foot) => foot.x)) - 21 - margin,
      Math.min(...feet.map((foot) => foot.y)) - 21 - margin,
      bottom + height - margin],
    [Math.max(...feet.map((foot) => foot.x)) + 21 + margin,
      Math.max(...feet.map((foot) => foot.y)) + 21 + margin,
      bottom + height + 0.02 + margin],
  );
  try { return intersect(source, band); }
  finally { band.delete(); }
}
