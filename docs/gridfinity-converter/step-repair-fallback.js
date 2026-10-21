/** Retry rejected selective repair with full repair; native traps are terminal. */
export async function withStepRepairFallback({enabled, attempt, onProgress = () => {}}) {
  const policies = enabled ? ['selective', 'full'] : ['full'];
  for (const policy of policies) {
    try {
      return {value: await attempt(policy), repairPolicy: policy, repairRetried: enabled && policy === 'full'};
    } catch (error) {
      if (error instanceof WebAssembly.RuntimeError || policy !== 'selective' ||
          !/exported STEP fails strict|STEP export changed/.test(error?.message ?? '')) throw error;
      onProgress('Retrying STEP verification with full repair…', {
        diagnostic: 'step-export-verifier', stage: 'repair-fallback', reason: error.message,
      });
    }
  }
  throw Error('STEP repair verification did not produce a result.');
}
