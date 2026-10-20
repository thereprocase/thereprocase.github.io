/** Prepare exact local geometry; borrowed source is never modified or deleted.
 * Caller owns returned shapes and passes `own` when using a conversion arena.
 */
export async function prepareNativeLocalEdit({ cad, source, feet, bottom, height,
  fit, maximumHoleDepth, maximumHoleRadius, roof, nativeFoot,
  cut, fuse, intersect, union, volume, own = shape => shape, onProgress = () => {} }) {
  if (!feet.length) throw Error('Select at least one foot before converting.');
  const made = new Set();
  const keep = shape => { made.add(shape); return own(shape); };
  const box = (lo, hi) => keep(cad.makeBox(lo, hi));
  try {
    const margin = Math.max(22 + Math.abs(fit), 13 + maximumHoleRadius + .1);
    const xs = feet.flatMap(f => [f.x, f.sourceX ?? f.x]);
    const ys = feet.flatMap(f => [f.y, f.sourceY ?? f.y]);
    // Contains every removal tool, replacement foot, seam probe and roof probe.
    const editBox = box(
      [Math.min(...xs)-margin, Math.min(...ys)-margin, bottom-.1],
      [Math.max(...xs)+margin, Math.max(...ys)+margin,
        bottom+Math.max(4.75, height+.02, maximumHoleDepth+roof)+.1],
    );
    onProgress('Preparing the shared native edit region…');
    const localSource = keep(intersect(source, editBox));
    const cuts = [], newFeet = [];
    for (const [index, f] of feet.entries()) {
      const sx=f.sourceX ?? f.x, sy=f.sourceY ?? f.y;
      cuts.push(box([Math.min(sx,f.x)-20.99,Math.min(sy,f.y)-20.99,bottom-.02],
        [Math.max(sx,f.x)+20.99,Math.max(sy,f.y)+20.99,bottom+height]));
      const foot=keep(await nativeFoot(f.x,f.y,bottom,height+.02,fit));
      newFeet.push(foot);
      onProgress(`Checking attachment ${index+1} of ${feet.length}…`);
      const seam=box([f.x-21,f.y-21,bottom+height],[f.x+21,f.y+21,bottom+height+.02]);
      let localSeam, contact;
      try {
        localSeam=keep(intersect(localSource,seam));
        contact=keep(intersect(localSeam,foot));
        if(volume(contact)<.02) throw Error('Native CAD foot has no substantial contact with the part at the seam.');
      } finally {contact?.delete();localSeam?.delete();seam.delete();}
    }
    const cutsUnion=keep(union(cuts)),feetUnion=keep(union(newFeet));
    const trimmed=keep(cut(localSource,cutsUnion));
    const localPlain=keep(fuse(trimmed,feetUnion));
    trimmed.delete();
    return { editBox, localSource, localPlain, cutsUnion, feetUnion,
      regions:[...cuts,...newFeet], dispose(){for(const shape of made)shape.delete();},
      /** ((S\C) union F)\H = (S\(C union H)) union (F\H). */
      assemble(holes) {
        let combined, drilled, remainder;
        try {
          combined=holes ? keep(union([cutsUnion,holes])) : cutsUnion;
          drilled=holes ? keep(cut(feetUnion,holes)) : feetUnion;
          remainder=keep(cut(source,combined));
          // Returned final solid belongs to the caller, not dispose().
          return own(fuse(remainder,drilled));
        } finally {
          remainder?.delete();
          if(combined!==cutsUnion)combined?.delete();
          if(drilled!==feetUnion)drilled?.delete();
        }
      },
    };
  } catch(error) {for(const shape of made)shape.delete();throw error;}
}
