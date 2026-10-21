/** Reopen app-produced STEP with checked reader statuses and owned handles.
 * Geometry validation remains the caller's responsibility. Selective repair is
 * opt-in and supported only by the dedicated experimental verifier kernel.
 */
export async function readVerifierSTEP(oc, blob, wrap, onProgress = () => {}, {selectiveRepair = false} = {}) {
  const path = '/verified-reopen.step';
  let reader;
  const phase = (stage, operation) => {
    const start = performance.now();
    try { return operation(); }
    finally { onProgress('Reopening exported STEP…', {
      diagnostic: 'step-export-verifier', stage, elapsedMS: performance.now() - start,
    }); }
  };
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    phase('reopen-write-memory', () => oc.FS.writeFile(path, bytes));
    reader = new oc.STEPControl_Reader();
    const read = phase('reopen-parse', () => reader.ReadFile(path));
    if (read !== oc.IFSelect_ReturnStatus.IFSelect_RetDone)
      throw Error('The exported STEP fails strict parsing. STEP export blocked.');
    const policyStarted = performance.now();
    const selectiveApplied = selectiveRepair && typeof oc.nativeSetStepReadFixMode === 'function';
    if (selectiveApplied) phase('reopen-processing-policy', () => {
      oc.nativeSetStepReadFixMode(reader, 'FixSameParameterMode', 0);
      oc.nativeSetStepReadFixMode(reader, 'FixEdgeSameParameterMode', 0);
    });
    onProgress('Reopening exported STEP…', {
      diagnostic: 'step-export-verifier', stage: 'reopen-processing-mode', elapsedMS: performance.now() - policyStarted,
      selectiveRequested: selectiveRepair, selectiveApplied,
      processing: selectiveApplied ? 'selective-same-parameter' : 'default',
    });
    const roots = phase('reopen-transfer', () => reader.TransferRoots());
    if (!(roots > 0)) throw Error('The exported STEP fails strict root transfer. STEP export blocked.');
    return phase('reopen-extract', () => {
      const raw = reader.OneShape();
      try { return wrap(raw); }
      finally { raw.delete(); }
    });
  } finally {
    try { oc.FS.unlink(path); } catch { /* A failed write may not create a file. */ }
    if (reader) phase('reopen-reader-cleanup', () => reader.delete());
  }
}
