import * as THREE from 'three';
import { createEnvironment, createSlab } from './stone.js';
import { products } from './products.js';

/**
 * The 3D hero: a fan of polished granite slabs lit by a real environment map.
 *
 * Upgrades over the flat-material version:
 *  - PMREM studio environment, so the polished faces actually reflect
 *  - procedural roughness map, so mineral grain glints
 *  - scroll-driven dispersal: as the hero leaves the viewport the fan spreads
 *    and the camera pulls back, handing the eye off to the content below
 *  - honours prefers-reduced-motion by rendering a single still frame
 *
 * Returns { dispose() } or null when WebGL is unavailable.
 */
export function initHeroScene(canvas) {
  if (!canvas || typeof WebGLRenderingContext === 'undefined') return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    canvas.style.display = 'none';
    return null;
  }

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const envMap = createEnvironment(renderer);
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  camera.position.set(0, 0.9, 9.2);

  // ---- lights (env does the ambient lifting; these shape the highlights) --
  const key = new THREE.DirectionalLight(0xf0f4fb, 1.9);
  key.position.set(4, 6, 5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x6b84b5, 0.45);
  fill.position.set(-5, -2, -4);
  scene.add(fill);

  const rimA = new THREE.PointLight(0xc2d0e4, 22, 15);
  rimA.position.set(-3.5, 1.8, 3.2);
  scene.add(rimA);

  const rimB = new THREE.PointLight(0x7e93b5, 14, 13);
  rimB.position.set(3.4, -1.4, 2.8);
  scene.add(rimB);

  // ---- granite slabs -----------------------------------------------------
  const group = new THREE.Group();
  scene.add(group);

  const SLABS = 6;
  const slabs = [];

  for (let i = 0; i < SLABS; i++) {
    const product = products[i % products.length];
    const slab = createSlab({
      palette: product.palette,
      seedOffset: i * 13,
      size: 512,
    });
    group.add(slab);
    slabs.push(slab);
  }

  // arrange in a fan arc, remembering the base layout for scroll dispersal
  const radius = 2.35;
  slabs.forEach((slab, i) => {
    const angle = (i - (SLABS - 1) / 2) * 0.52;
    const x = Math.sin(angle) * radius;
    const y = 0.15 + Math.sin(i * 1.7) * 0.18;
    const z = -Math.cos(angle) * radius + 0.45;

    slab.position.set(x, y, z);
    slab.rotation.y = -angle;
    slab.rotation.x = 0.08 + Math.abs(Math.sin(i)) * 0.12;

    slab.userData.base = { x, y, z, ry: slab.rotation.y, rx: slab.rotation.x };
    slab.userData.speed = 0.55 + i * 0.12;
    slab.userData.phase = i * 1.1;
    slab.userData.dir = Math.sign(x) || (i % 2 ? 1 : -1);
  });

  // ---- silver dust -------------------------------------------------------
  const COUNT = 240;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 15;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xd6e3f6,
    size: 0.035,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(pGeo, pMat);
  scene.add(dust);

  // ---- soft contact shadow ----------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.6;
  scene.add(ground);

  // ---- interaction -------------------------------------------------------
  const mouse = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const onPointerMove = (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // ---- scroll progress through the hero (0 → 1) ---------------------------
  const heroEl = canvas.parentElement || canvas;
  let scrollP = 0;
  let scrollTarget = 0;
  function readScroll() {
    const h = heroEl.getBoundingClientRect().height || window.innerHeight;
    scrollTarget = Math.min(1, Math.max(0, window.scrollY / h));
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  // ---- sizing ------------------------------------------------------------
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- loop --------------------------------------------------------------
  const clock = new THREE.Clock();
  let running = true;

  function frame() {
    const t = clock.getElapsedTime();

    scrollP += (scrollTarget - scrollP) * 0.06;
    group.rotation.y = Math.sin(t * 0.09) * 0.35 - scrollP * 0.5;

    slabs.forEach((slab, i) => {
      const b = slab.userData.base;
      const spread = 1 + scrollP * 0.85;

      slab.position.x = b.x * spread;
      slab.position.y =
        b.y + Math.sin(t * slab.userData.speed + slab.userData.phase) * 0.1 - scrollP * 0.25;
      slab.position.z = b.z + scrollP * 0.5;

      slab.rotation.z = Math.sin(t * 0.4 + i * 0.9) * 0.03;
      slab.rotation.x = b.rx - scrollP * 0.28;
    });

    target.x += (mouse.x - target.x) * 0.035;
    target.y += (mouse.y - target.y) * 0.035;
    camera.position.x = target.x * 0.9;
    camera.position.y = 0.9 + target.y * -0.35 + scrollP * 1.15;
    camera.position.z = 9.2 + scrollP * 2.4;
    camera.lookAt(0, 0.15, 0);

    dust.rotation.y = t * 0.02;

    renderer.render(scene, camera);
  }

  function tick() {
    if (!running) return;
    frame();
    requestAnimationFrame(tick);
  }

  if (reduceMotion) {
    // Single still frame — no animation loop, no scroll coupling.
    renderer.render(scene, camera);
  } else {
    tick();
  }

  const onVisibility = () => {
    const hidden = document.hidden;
    if (hidden && running) {
      running = false;
    } else if (!hidden && !running && !reduceMotion) {
      running = true;
      tick();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    dispose() {
      running = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);

      slabs.forEach((s) => {
        (s.userData.disposables || []).forEach((d) => d && d.dispose && d.dispose());
      });
      pGeo.dispose();
      pMat.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      envMap.dispose();
      renderer.dispose();
    },
  };
}
