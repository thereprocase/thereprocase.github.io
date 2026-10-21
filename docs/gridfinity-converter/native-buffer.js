/** OCCT's wasm32 bindings return some addresses as signed C++ int values. */
export function copyNativeArray(Type, buffer, pointer, length) {
  if (!Number.isInteger(pointer) || pointer < -0x80000000 || pointer > 0xffffffff ||
      !Number.isSafeInteger(length) || length < 0)
    throw Error('Invalid native mesh buffer address or length.');
  const offset = pointer >>> 0;
  const bytes = length * Type.BYTES_PER_ELEMENT;
  if (offset % Type.BYTES_PER_ELEMENT || !Number.isSafeInteger(bytes) ||
      offset + bytes > buffer.byteLength)
    throw Error('Native mesh buffer exceeds allocated memory.');
  return new Type(buffer, offset, length).slice();
}
