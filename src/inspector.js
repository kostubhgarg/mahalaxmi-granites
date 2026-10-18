// Interactive product inspector.
//
// Opens a modal that renders the selected granite as a single large polished
// slab you can drag to rotate and scroll to zoom. The slab stays lit by the
// same PMREM studio environment as the hero, so the two views agree.

import * as THREE from 'three';
import { createEnvironment, createSlab, disposeSlab } from './stone.js';

const MIN_ZOOM = 3.4;
const MAX_ZOOM = 8.2;

export function initInspector() {
  const root = document.getElementById('viewer');
  const canvas = document.getElementById('viewer-canvas');
  if (!root || !canvas) return null;

  const els = {
    name: document.getElementById('viewer-name'),
    tag: document.getElementById('viewer-tag'),
    price: document.getElementById('viewer-price'),
    origin: document.getElementById('viewer-origin'),
    finish: document.getElementById('viewer-finish'),
    close: document.getElementById('viewer-close'),
    cta: document.getElementById('viewer-cta'),
    stage: document.getElementById('viewer-stage'),
  };

  let renderer = null;
  let scene = null;
  let camera = null;
  let envMap = null;
  let slab = null;
  let running = false;
  let current = null;
  let lastFocus = null;

  const rot = { y: -0.5, x: 0.42 };
  const rotTarget = { y: -0.5, x: 0.42 };
  let zoom = 6.0;
  let zoomTarget = 6.0;
  let reveal = 0;
  let dragging = false;
  let idle = 0;
  let last = { x: 0, y: 0 };

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ scene ---- */

  function build() {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    scene = new THREE.Scene();
    envMap = createEnvironment(renderer);
    scene.environment = envMap;

    camera = new THREE.PerspectiveCamera(38, 1.6, 0.1, 60);
    camera.position.set(0, 0.6, zoom);
    camera.lookAt(0, 0, 0);

    const key = new THREE.DirectionalLight(0xf2f6fc, 2.0);
    key.position.set(3.5, 5.5, 4.5);
    scene.add(key);

    const rim = new THREE.PointLight(0xbfcfe6, 18, 14);
    rim.position.set(-3, 1.6, 3);
    scene.add(rim);

    const rim2 = new THREE.PointLight(0x7f93b8, 10, 12);
    rim2.position.set(3, -1.6, 2.4);
    scene.add(rim2);

    resize();
  }

  function resize() {
    if (!renderer || !els.stage) return;
    const r = els.stage.getBoundingClientRect();
    const w = Math.max(r.width, 1);
    const h = Math.max(r.height, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function clearSlab() {
    if (!slab) return;
    scene.remove(slab);
    disposeSlab(slab);
    slab = null;
  }

  /* ------------------------------------------------------------- loop ---- */

  function frame() {
    const t = performance.now() / 1000;

    idle += 1;
    if (!dragging && idle > 45 && !reduceMotion) rotTarget.y += 0.0042;

    rot.y += (rotTarget.y - rot.y) * 0.09;
    rot.x += (rotTarget.x - rot.x) * 0.09;
    zoom += (zoomTarget - zoom) * 0.08;
    reveal += (1 - reveal) * 0.09;

    if (slab) {
      slab.rotation.y = rot.y;
      slab.rotation.x = rot.x;
      const s = 0.9 + reveal * 0.1;
      slab.scale.setScalar(s);
      slab.position.y = Math.sin(t * 0.8) * 0.05 * (reduceMotion ? 0 : 1);
    }

    camera.position.z = zoom;
    camera.position.y = 0.6 + rot.x * 0.55;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  function tick() {
    if (!running) return;
    frame();
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------------- interaction -- */

  function onPointerDown(e) {
    dragging = true;
    idle = 0;
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
    canvas.classList.add('grabbing');
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    rotTarget.y += dx * 0.008;
    rotTarget.x = Math.max(-1.15, Math.min(1.15, rotTarget.x + dy * 0.006));
  }

  function onPointerUp(e) {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
    canvas.classList.remove('grabbing');
  }

  function onWheel(e) {
    e.preventDefault();
    zoomTarget = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomTarget + e.deltaY * 0.0022));
    idle = 0;
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  /* --------------------------------------------------------- open/close -- */

  function open(product) {
    if (!product) return;
    current = product;
    lastFocus = document.activeElement;

    els.name.textContent = product.name;
    els.tag.textContent = product.tagline;
    els.price.textContent = product.price;
    els.origin.textContent = product.origin;
    els.finish.textContent = product.finish;
    els.cta.dataset.name = product.name;

    root.hidden = false;
    document.body.classList.add('viewer-open');

    if (!renderer) build();

    clearSlab();
    slab = createSlab({
      palette: product.palette,
      width: 3.1,
      height: 0.14,
      depth: 1.95,
      size: 640,
    });
    slab.rotation.x = rotTarget.x;
    slab.rotation.y = rotTarget.y;
    scene.add(slab);

    rot.y = rotTarget.y = -0.5;
    rot.x = rotTarget.x = 0.42;
    zoom = zoomTarget = 6.0;
    reveal = 0;

    // wait a frame so the stage has its final size before measuring
    requestAnimationFrame(() => {
      resize();
      if (!running) {
        running = true;
        tick();
      }
    });

    els.close.focus?.();
  }

  function close() {
    if (root.hidden) return;
    running = false;
    root.hidden = true;
    document.body.classList.remove('viewer-open');
    clearSlab();
    current = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ------------------------------------------------------------- wiring -- */

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  els.close.addEventListener('click', close);
  root.querySelectorAll('[data-viewer-close]').forEach((el) => {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', onKey);

  window.addEventListener('resize', () => {
    if (!root.hidden) resize();
  });

  const onVisibility = () => {
    if (document.hidden) running = false;
    else if (!root.hidden && !running) {
      running = true;
      tick();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    open,
    close,
    isOpen: () => !root.hidden,
    current: () => current,
  };
}
