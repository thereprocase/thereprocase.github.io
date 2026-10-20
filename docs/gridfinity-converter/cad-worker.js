/* OCCT runs in a terminable classic worker; user files never leave the browser. */
importScripts('./vendor/occt/occt-import-js.js');
let ready;
onmessage = async ({ data }) => {
  try {
    ready ??= occtimportjs({ locateFile: (path) => './vendor/occt/' + path });
    const occt = await ready;
    const result = occt.ReadFile(data.format, new Uint8Array(data.buffer), {
      linearUnit: 'millimeter',
      linearDeflectionType: 'absolute_value',
      linearDeflection: 0.025,
      angularDeflection: 0.15,
    });
    if (!result.success)
      throw Error(
        'CAD import failed. Export a closed solid STEP or STL and retry.',
      );
    postMessage({ result });
  } catch (e) {
    postMessage({ error: e.message });
  }
};
