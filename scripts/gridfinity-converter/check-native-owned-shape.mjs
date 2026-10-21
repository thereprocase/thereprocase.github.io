import assert from 'node:assert/strict';
import { nativeFoot } from '../../public/gridfinity-converter/native-cad.js';
import { castOwned, ownedSolids, ownedCompound } from '../../public/gridfinity-converter/native-owned-shape.js';
import { nativeFaces } from '../../public/gridfinity-converter/native-preservation.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
(await nativeFoot()).delete();
const oc = cad.getOC();
let disposed = 0;
function counted(raw) {
  const dispose = raw.delete.bind(raw);
  raw.delete = () => { disposed++; dispose(); };
  return raw;
}
const source = cad.makeBox([0,0,0],[1,2,3]);
const text = source.serialize();
const reopened = castOwned(cad, counted(oc.BRepToolsWrapper.Read(text)));
assert.equal(disposed, 1);
assert.equal(cad.measureVolume(reopened), 6);
const trsf = new oc.gp_Trsf();
const builder = new oc.BRepBuilderAPI_Transform(source.wrapped, trsf, true, false);
const copied = castOwned(cad, counted(builder.Shape()));
builder.delete(); trsf.delete(); source.delete();
assert.equal(disposed, 2);
assert.equal(cad.measureVolume(copied), 6);
const explorer = new oc.TopExp_Explorer(copied.wrapped, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
const face = castOwned(cad, counted(explorer.Current()));
explorer.delete(); copied.delete();
assert.equal(disposed, 3);
assert.ok(face.serialize().includes('TShapes'));
const analyzer = new oc.BRepCheck_Analyzer(reopened.wrapped,true,false,true);
assert.equal(analyzer.IsValid(),true); analyzer.delete();
const current = oc.TopExp_Explorer.prototype.Current;
let currentReturns = 0, currentDeletes = 0;
oc.TopExp_Explorer.prototype.Current = function() {
  const raw = current.call(this), dispose = raw.delete.bind(raw);
  currentReturns++;
  raw.delete = () => { currentDeletes++; dispose(); };
  return raw;
};
Object.assign(oc.TopExp_Explorer.prototype.Current, current);
let faces, solids;
try { faces = nativeFaces(oc,cad,reopened); solids = ownedSolids(oc,cad,reopened); }
finally { oc.TopExp_Explorer.prototype.Current = current; }
assert.equal(faces.length,6);
assert.equal(currentReturns,7);
assert.equal(solids.length,1);
assert.equal(cad.measureVolume(solids[0]),6);
solids.forEach(s=>s.delete());
assert.equal(currentDeletes,currentReturns);
assert.ok(faces.every(f => f.serialize().includes('TShapes')));
const compound = ownedCompound(oc, cad, faces);
assert.equal(nativeFaces(oc, cad, compound).map(f => { f.delete(); return 1; }).length, 6);
compound.delete();
assert.ok(faces.every(f => f.serialize().includes('TShapes')), 'Compound borrows its input handles');
faces.forEach(f=>f.delete()); face.delete(); reopened.delete();
let failureDeletes=0;
assert.throws(()=>castOwned({cast(){throw Error('cast failed');}}, {delete(){failureDeletes++;}}),/cast failed/);
assert.equal(failureDeletes,1);
console.log(JSON.stringify({passed:true,ownedRawReturns:disposed,explorerReturns:currentReturns,explorerDisposals:currentDeletes,castFailureCleanup:true}));
