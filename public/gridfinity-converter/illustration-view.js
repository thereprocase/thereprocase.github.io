import * as THREE from 'three';
export const PALETTE = {
  teal: [0.36, 0.64, 0.69],
  orange: [0.98, 0.63, 0.28],
  ink: [0.114, 0.106, 0.094],
  context: [0.6, 0.64, 0.64],
};
const cache = new WeakMap(),
  pending = new Map();
let worker,
  serial = 0;
function presentation(data) {
  if (cache.has(data)) return cache.get(data);
  const promise = new Promise((resolve, reject) => {
    if (!worker) {
      worker = new Worker(
        new URL('./render-geometry-worker.js?v=native-step-20261021-5', import.meta.url),
        { type: 'module' },
      );
      const createdWorker = worker;
      createdWorker.onmessage = ({ data }) => {
        if (worker !== createdWorker) return;
        const task = pending.get(data.id);
        if (!task) return;
        pending.delete(data.id);
        if (data.error) task.reject(Error(data.error));
        else task.resolve(data);
      };
      createdWorker.onerror = createdWorker.onmessageerror = () => {
        if (worker !== createdWorker) return;
        createdWorker.terminate();
        worker = null;
        for (const task of pending.values())
          task.reject(Error('Presentation edges unavailable.'));
        pending.clear();
      };
    }
    const id = ++serial;
    pending.set(id, { resolve, reject });
    try {
      const vertices = data.vertices.slice(),
        triangles = data.triangles.slice();
      worker.postMessage({ id, vertices, triangles }, [
        vertices.buffer,
        triangles.buffer,
      ]);
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  }).catch((error) => {
    if (cache.get(data) === promise) cache.delete(data);
    throw error;
  });
  cache.set(data, promise);
  return promise;
}
const vertex = `
#include <clipping_planes_pars_vertex>
varying vec3 vView;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vView = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const fragment = `
#include <clipping_planes_pars_fragment>
varying vec3 vView;
uniform vec3 base;
uniform float opacity;
void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  vec3 l = normalize(vec3(-0.45, 0.75, 0.5));
  float d = max(dot(n,l),0.0);
  float band = d > 0.6 ? 1.0 : d > 0.25 ? 0.86 : 0.72;
  vec3 c = base * band;
  if (1.0 - abs(n.z) > 0.82) c *= 0.85;
  gl_FragColor = vec4(c, opacity);
}`;
function inkMaterial(clips, hull) {
  return new THREE.ShaderMaterial({
    clipping: true,
    clippingPlanes: clips,
    side: hull ? THREE.BackSide : THREE.FrontSide,
    uniforms: {
      push: { value: 0 },
      ink: { value: new THREE.Vector3(...PALETTE.ink) },
    },
    vertexShader: `
      #include <clipping_planes_pars_vertex>
      uniform float push;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position ${hull ? '+ normal * push' : ''}, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        ${hull ? '' : 'gl_Position.z -= 0.0004 * gl_Position.w;'}
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `
      #include <clipping_planes_pars_fragment>
      uniform vec3 ink;
      void main() {
        #include <clipping_planes_fragment>
        gl_FragColor = vec4(ink, 1.0);
      }`,
  });
}
export function illustrationMesh(
  data,
  { color = PALETTE.teal, opacity = 1, clips, camera, target, requestRender },
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(data.vertices, 3),
  );
  geometry.setIndex(new THREE.BufferAttribute(data.triangles, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      base: { value: new THREE.Vector3(...color) },
      opacity: { value: opacity },
    },
    transparent: opacity < 1,
    depthWrite: opacity === 1,
    side: THREE.DoubleSide,
    clipping: true,
    clippingPlanes: clips,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  if (opacity === 1)
    presentation(data)
      .then(({ normals, edges }) => {
        if (mesh.userData.disposed) return;
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        const hull = new THREE.Mesh(geometry, inkMaterial(clips, true));
        hull.renderOrder = 0;
        hull.onBeforeRender = () => {
          hull.material.uniforms.push.value =
            camera.position.distanceTo(target) * 0.0022;
        };
        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute(
          'position',
          new THREE.BufferAttribute(edges, 3),
        );
        const contours = new THREE.LineSegments(
          edgeGeometry,
          inkMaterial(clips, false),
        );
        contours.renderOrder = 2;
        mesh.add(hull, contours);
        mesh.userData.illustrationReady = true;
        requestRender();
      })
      .catch(() => {
        /* The accurate cel surface remains visible without optional ink. */
      });
  return mesh;
}
