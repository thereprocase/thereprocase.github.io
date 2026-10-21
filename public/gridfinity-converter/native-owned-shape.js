/** Consume an owned TopoDS return handle, retaining the independent downcast.
 * Replicad cast() creates a second handle; it does not release its input.
 * Never pass a borrowed shape.wrapped reference here: clone it first.
 */
export function castOwned(cad, raw) {
  try {
    return cad.cast(raw);
  } finally {
    raw.delete();
  }
}

/** Build a compound from borrowed shapes; release both temporary OCCT handles. */
export function ownedCompound(oc, cad, shapes) {
  const builder = new oc.TopoDS_Builder();
  const compound = new oc.TopoDS_Compound();
  try {
    builder.MakeCompound(compound);
    for (const shape of shapes) builder.Add(compound, shape.wrapped);
    return cad.cast(compound);
  } finally {
    compound.delete();
    builder.delete();
  }
}

/** Owned solid enumeration, matching Replicad's IsSame deduplication. */
export function ownedSolids(oc, cad, shape) {
  const explorer = new oc.TopExp_Explorer(shape.wrapped,
    oc.TopAbs_ShapeEnum.TopAbs_SOLID, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  const solids = [];
  try {
    while (explorer.More()) {
      const solid = castOwned(cad, explorer.Current());
      if (solids.some(other => solid.isSame(other))) solid.delete();
      else solids.push(solid);
      explorer.Next();
    }
    return solids;
  } catch (error) {
    solids.forEach(solid => solid.delete());
    throw error;
  } finally {
    explorer.delete();
  }
}
