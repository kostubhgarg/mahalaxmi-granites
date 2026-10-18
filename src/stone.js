// Shared 3D stone primitives.
//
// The original hero lit flat BoxGeometry with MeshStandardMaterial, so
// "mirror polished" granite never actually reflected anything. This module
// adds a PMREM-filtered studio environment plus a procedural roughness map
// derived from the granite grain, which is what makes polished stone glint.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createGraniteTexture } from './textures.js';

/* ---------------------------------------------------------------- env ---- */

/**
 * Build a PMREM-filtered environment map. Created once per renderer and
 * assigned to scene.environment, so every MeshPhysicalMaterial in that scene
 * picks up believable reflections.
 */
export function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.03).texture;
  if (typeof room.dispose === 'function') room.dispose();
  pmrem.dispose();
  return envMap;
}

/* ------------------------------------------------------------- maps ----- */

/**
 * Granite colour map + a roughness map derived from the mineral grain.
 * Darker mineral inclusions read as glossier stone, which produces the
 * scattered glints you see on a polished slab.
 */
export function createStoneMaps(palette, size = 512) {
  const canvas = createGraniteTexture({ size, ...palette });
  const ctx = canvas.getContext('2d');
  const src = ctx.getImageData(0, 0, size, size);

  const rough = document.createElement('canvas');
  rough.width = rough.height = size;
  const rctx = rough.getContext('2d');
  const rimg = rctx.createImageData(size, size);

  for (let i = 0; i < src.data.length; i += 4) {
    const lum =
      (src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114) / 255;
    const v = Math.round(255 * Math.min(1, 0.16 + lum * 0.6));
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = v;
    rimg.data[i + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  for (const t of [map, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  return { map, roughnessMap };
}

/* ------------------------------------------------------------ slab ------ */

/**
 * A polished granite slab: bevelled top face with a clear coat, matte
 * cut edges, and a thin silver rim so the silhouette reads against the
 * dark backdrop.
 */
export function createSlab({
  palette,
  width = 2.15,
  height = 0.075,
  depth = 1.35,
  size = 512,
  seedOffset = 0,
  rim = true,
} = {}) {
  const maps = createStoneMaps(
    seedOffset ? { ...palette, seed: (palette.seed ?? 1) + seedOffset } : palette,
    size,
  );

  const geometry = new THREE.BoxGeometry(width, height, depth);

  // BoxGeometry face order: [+x, -x, +y, -y, +z, -z]. Index 2 is the top.
  const polished = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.055,
    envMapIntensity: 1.35,
  });

  const cut = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    color: 0x8e9bb0,
    roughness: 0.66,
    metalness: 0.06,
    clearcoat: 0.3,
    envMapIntensity: 0.8,
  });

  const mesh = new THREE.Mesh(geometry, [cut, cut, polished, cut, cut, cut]);

  const disposables = [maps.map, maps.roughnessMap, polished, cut, geometry];

  if (rim) {
    const rimGeo = new THREE.EdgesGeometry(geometry);
    const rimMat = new THREE.LineBasicMaterial({
      color: 0xc6d4e8,
      transparent: true,
      opacity: 0.42,
    });
    mesh.add(new THREE.LineSegments(rimGeo, rimMat));
    disposables.push(rimGeo, rimMat);
  }

  mesh.userData.disposables = disposables;
  return mesh;
}

/** Release a slab created by createSlab(). */
export function disposeSlab(mesh) {
  (mesh.userData.disposables || []).forEach((d) => {
    if (d && typeof d.dispose === 'function') d.dispose();
  });
  mesh.userData.disposables = [];
}
