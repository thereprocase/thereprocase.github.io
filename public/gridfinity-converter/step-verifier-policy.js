export function claimKernelPurpose(previous, next = 'model') {
  if (!['model', 'step-export-verifier'].includes(next)) throw Error('Unknown CAD kernel purpose');
  if (previous && previous !== next) throw Error('CAD kernel purpose mismatch');
  return next;
}
export function verifierTolerances(oc, shape) {
  return ['TopAbs_VERTEX','TopAbs_EDGE','TopAbs_FACE'].map(kind => oc.BRep_Tool.MaxTolerance(shape, oc.TopAbs_ShapeEnum[kind]));
}
export function assertVerifierSource(oc, shape) {
  const e = new oc.TopExp_Explorer(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    while (e.More()) {
      const raw = e.Current(); let edge;
      try {
        edge = oc.TopoDS.Edge(raw);
        if (!oc.BRep_Tool.Degenerated(edge) && (!oc.BRep_Tool.SameParameter(edge) || !oc.BRep_Tool.SameRange(edge)))
          throw Error('The exported STEP fails strict source parameter checks. STEP export blocked.');
      } finally { edge?.delete(); raw.delete(); }
      e.Next();
    }
  } finally { e.delete(); }
}
export async function withStepWriterPolicy(oc, {surfaceCurves, precision}, write) {
  if (precision !== undefined && (!(precision > 0) || !Number.isFinite(precision)))
    throw Error('STEP export changed the source tolerance certificate. Export blocked.');
  const api=oc.Interface_Static;
  const before={surfaceCurves:api.IVal('write.surfacecurve.mode'),mode:api.IVal('write.precision.mode'),precision:api.RVal('write.precision.val')};
  try {
    if(api.SetIVal('write.surfacecurve.mode',surfaceCurves)===false)throw Error('STEP export changed the requested writer policy. Export blocked.');
    if (precision !== undefined) { if(api.SetIVal('write.precision.mode',2)===false || api.SetRVal('write.precision.val',precision)===false)throw Error('STEP export changed the requested precision policy. Export blocked.'); }
    return await write();
  } finally {
    let failure;
    for(const [method,key,value] of [['SetIVal','write.surfacecurve.mode',before.surfaceCurves],['SetRVal','write.precision.val',before.precision],['SetIVal','write.precision.mode',before.mode]]) {
      try {if(api[method](key,value)===false)throw Error('STEP export changed the restored writer policy. Export blocked.');}catch(error){failure??=error;}
    }
    if(failure)throw failure;
  }
}
/** Constructing the first STEP writer registers its Interface_Static parameters. */
export async function writeVerifierSTEP(oc, shape, precision) {
  const writer = new oc.STEPControl_Writer();
  let progress, schema;
  const filename='/verified-export.step';
  try {
    progress = new oc.Message_ProgressRange();
    schema=oc.Interface_Static.IVal('write.step.schema');
    if(oc.Interface_Static.SetIVal('write.step.schema',5)===false)throw Error('STEP export changed the requested schema. Export blocked.');
    return await withStepWriterPolicy(oc,{surfaceCurves:1,precision},()=>{
      const transferred=writer.Transfer(shape,oc.STEPControl_StepModelType.STEPControl_AsIs,true,progress);
      if(transferred!==oc.IFSelect_ReturnStatus.IFSelect_RetDone)throw Error('STEP export changed the source representation during transfer. Export blocked.');
      if(oc.nativeWriteStep17(writer,filename)!==oc.IFSelect_ReturnStatus.IFSelect_RetDone)throw Error('STEP export changed the source representation during write. Export blocked.');
      return new Blob([oc.FS.readFile(filename)],{type:'application/STEP'});
    });
  } finally {
    try {
      if(schema!==undefined && oc.Interface_Static.SetIVal('write.step.schema',schema)===false)throw Error('STEP export changed the restored schema. Export blocked.');
    } finally {
      try {oc.FS.unlink(filename);}catch{}
      try {progress?.delete();}finally{writer.delete();}
    }
  }
}
export function verifierExactBounds(oc, shape) {
  const box=new oc.Bnd_Box();
  try {
    if(typeof oc.nativeAddOptimalParallel==='function')oc.nativeAddOptimalParallel(shape,box,false);
    else oc.BRepBndLib.AddOptimal(shape,box,false,false);
    return [[box.GetXMin(),box.GetYMin(),box.GetZMin()],[box.GetXMax(),box.GetYMax(),box.GetZMax()]];
  } finally {box.delete();}
}
export function assertFiniteStepMetrics({bounds, volume, tolerances}, requireTolerances=false) {
  const finiteBounds=Array.isArray(bounds)&&bounds.length===2&&bounds.every(row=>Array.isArray(row)&&row.length===3&&row.every(Number.isFinite))&&bounds[0].every((v,i)=>v<=bounds[1][i]);
  const finiteTolerances=!requireTolerances || (Array.isArray(tolerances)&&tolerances.length===3&&tolerances.every(v=>Number.isFinite(v)&&v>=0));
  if(!Number.isFinite(volume)||!finiteBounds||!finiteTolerances)
    throw Error('STEP export changed the geometry certificate: non-finite or malformed metrics. Export blocked.');
}
