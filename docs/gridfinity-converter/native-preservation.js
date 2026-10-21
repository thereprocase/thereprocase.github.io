import { castOwned, ownedCompound } from './native-owned-shape.js?v=native-step-20261021-4';
/** Exact boundary comparison outside a convex box; meshes never participate. */
export function nativeFaces(oc, cad, shape) {
  const explorer = new oc.TopExp_Explorer(shape.wrapped,
    oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  const faces = [], buckets = new Map();
  try {
    while (explorer.More()) {
      const face = castOwned(cad, explorer.Current()), hash = face.hashCode;
      const bucket = buckets.get(hash) || [];
      if (bucket.some((other) => face.isEqual(other))) face.delete();
      else { bucket.push(face); buckets.set(hash, bucket); faces.push(face); }
      explorer.Next();
    }
  } catch (error) {
    faces.forEach(face => face.delete());
    throw error;
  } finally { explorer.delete(); }
  return faces;
}
function bucketsFor(faces) {
  const buckets = new Map();
  for (const face of faces) {
    const hash = face.hashCode, bucket = buckets.get(hash) || [];
    bucket.push(face); buckets.set(hash, bucket);
  }
  return buckets;
}
/** Caller supplies a convex editBox and exact-valid bounded regular solids. Unsupported cases fall back. */
export function proveNativePreservation({ oc, cad, source, result, editBox, cut, validatedSolids = false, sourceSignedVolume, resultSignedVolume }) {
  const owned = [];
  const keep = (shape) => { owned.push(shape); return shape; };
  try {
    if (!validatedSolids || !Number.isFinite(sourceSignedVolume) ||
        !Number.isFinite(resultSignedVolume) || !(sourceSignedVolume > 0) || !(resultSignedVolume > 0))
      return { proved: false, reason: 'Requires exact-valid finite positive solids' };
    const original = nativeFaces(oc, cad, source), converted = nativeFaces(oc, cad, result);
    owned.push(...original, ...converted);
    const originalBuckets = bucketsFor(original), convertedBuckets = bucketsFor(converted);
    const changed = (faces, buckets) => faces.filter((face) =>
      !(buckets.get(face.hashCode) || []).some((other) => face.isEqual(other)));
    const removed = changed(original, convertedBuckets), added = changed(converted, originalBuckets);
    // Keep multiplicity/orientation meaningful; duplicate oriented faces require full validation.
    const outside = (faces) => faces.length
      ? keep(cut(keep(ownedCompound(oc, cad, faces)), editBox))
      : null;
    const originalOutside = outside(removed), convertedOutside = outside(added);
    const missingDifference = originalOutside
      ? keep(convertedOutside ? cut(originalOutside, convertedOutside) : originalOutside.clone()) : null;
    const addedDifference = convertedOutside
      ? keep(originalOutside ? cut(convertedOutside, originalOutside) : convertedOutside.clone()) : null;
    const differences = [missingDifference, addedDifference].filter(Boolean);
    const residualFaces = differences.map((shape) => nativeFaces(oc, cad, shape));
    residualFaces.forEach((faces) => owned.push(...faces));
    const missingArea = missingDifference ? Math.abs(cad.measureArea(missingDifference)) : 0;
    const addedArea = addedDifference ? Math.abs(cad.measureArea(addedDifference)) : 0;
    // Both inputs are bounded regular solids. Their occupancy XOR is empty at
    // infinity and cannot change across identical boundaries. The complement
    // of this convex box is connected, so their material agrees outside it.
    // Reject even tiny residual faces; area tolerances cannot hide thin edits.
    const proved = original.length > removed.length && residualFaces.every((faces) => faces.length === 0);
    return { proved, method: 'convex-region-boundary-difference',
      unchangedFaces: original.length - removed.length,
      changedOriginalFaces: removed.length, changedResultFaces: added.length,
      missingAreaMM2: missingArea, addedAreaMM2: addedArea };
  } catch (error) {
    // A native trap can invalidate the kernel; never continue with fallback Booleans.
    if (error instanceof WebAssembly.RuntimeError) throw error;
    return { proved: false, method: 'convex-region-boundary-difference', reason: error.message };
  } finally {
    for (let i = owned.length - 1; i >= 0; i--) owned[i].delete();
  }
}
