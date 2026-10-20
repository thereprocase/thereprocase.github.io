// A narrow serialization-preservation fast path, not a replacement for BRepCheck.
export function equivalentBrepTokens(a, b) {
  const left = /\S+/g,
    right = /\S+/g,
    numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  let changed = 0,
    tokens = 0,
    maxAbsolute = 0;
  while (true) {
    const x = left.exec(a),
      y = right.exec(b);
    if (!x || !y)
      return {
        equivalent: !x && !y,
        tokens,
        changed,
        maxAbsolute,
        reason: x || y ? 'token count' : undefined,
      };
    tokens++;
    if (x[0] === y[0]) continue;
    // OCCT normalizes signed zero in translated direction vectors. Both
    // spellings represent exactly zero; this is not an integer/index change.
    if ((x[0] === '0' && y[0] === '-0') || (x[0] === '-0' && y[0] === '0')) {
      changed++;
      continue;
    }
    if (!numeric.test(x[0]) || !numeric.test(y[0]))
      return { equivalent: false, tokens, reason: 'non-numeric token' };
    const u = Number(x[0]),
      v = Number(y[0]);
    if (!Number.isFinite(u) || !Number.isFinite(v))
      return { equivalent: false, tokens, reason: 'non-finite token' };
    // Integer-to-integer topology, enumeration, and count changes are forbidden.
    if (/^[+-]?\d+$/.test(x[0]) && /^[+-]?\d+$/.test(y[0]))
      return { equivalent: false, tokens, reason: 'integer token' };
    const delta = Math.abs(u - v);
    if (
      delta >
      Math.min(
        1e-12,
        8 * Number.EPSILON * Math.max(1, Math.abs(u), Math.abs(v)),
      )
    )
      return { equivalent: false, tokens, reason: 'numeric change' };
    changed++;
    maxAbsolute = Math.max(maxAbsolute, delta);
  }
}
