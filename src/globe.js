// 3D Moon: sharp airless terminator lit from the computed sub-solar point,
// site markers, and a marker toward the sub-Earth point.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createMoon, toThree } from './moon3d.js';

export function createGlobe(canvas, { reducedMotion }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch {
    canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'globe-hint', textContent: '3D view needs WebGL, which this browser has turned off. The navigator works without it.' }));
    return { update() {}, focus() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x05070a, 1);
  let dirty = true, visible = true, tween = null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, -2.2, 3.4);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const moon = createMoon({ hi: false, segments: 128 });
  scene.add(moon.group);
  THREE.DefaultLoadingManager.onLoad = () => { dirty = true; };
  // Faint graticule every 15 degrees
  const gpts = [];
  for (let lat = -75; lat <= 75; lat += 15) for (let i = 0; i < 120; i++) gpts.push(toThree(lat, i * 3, 1.002), toThree(lat, (i + 1) * 3, 1.002));
  for (let lon = 0; lon < 360; lon += 15) for (let i = 0; i < 60; i++) gpts.push(toThree(-90 + i * 3, lon, 1.002), toThree(-87 + i * 3, lon, 1.002));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gpts), new THREE.LineBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.12 })));

  const markers = new THREE.Group();
  scene.add(markers);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 40), new THREE.MeshBasicMaterial({ color: 0xffc24d, side: THREE.DoubleSide }));
  scene.add(ring);

  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16), new THREE.MeshBasicMaterial({ color: 0x6aa6ec }));
  scene.add(earth);
  const earthLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x6aa6ec, dashSize: 0.04, gapSize: 0.04, transparent: true, opacity: 0.6 }));
  scene.add(earthLine);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reducedMotion; controls.enablePan = false;
  controls.minDistance = 2.2; controls.maxDistance = 6;
  controls.rotateSpeed = 0.6;

  
  controls.addEventListener('change', () => { dirty = true; });

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.t0) / 900);
      const k = 1 - Math.pow(1 - t, 3);
      camera.position.copy(tween.from).lerp(tween.to, k).setLength(tween.dist);
      camera.lookAt(0, 0, 0);
      if (t >= 1) tween = null;
      dirty = true;
    }
    if (controls.update()) dirty = true;
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  });

  return {
    setSites(sites) {
      markers.clear();
      const geo = new THREE.SphereGeometry(0.014, 12, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0xe9eae6 });
      for (const s of sites) { const m = new THREE.Mesh(geo, mat); m.position.copy(toThree(s.lat, s.lon, 1.003)); markers.add(m); }
      dirty = true;
    },
    update(site, geom) {
      moon.setSun(geom.subSolar);
      const p = toThree(site.lat, site.lon, 1.004);
      ring.position.copy(p); ring.lookAt(p.clone().multiplyScalar(2));
      const ep = toThree(geom.subEarth.lat, geom.subEarth.lon, 2.0);
      earth.position.copy(ep);
      earthLine.geometry.setFromPoints([toThree(geom.subEarth.lat, geom.subEarth.lon, 1.02), ep]);
      earthLine.computeLineDistances();
      dirty = true;
    },
    focus(site) {
      // View the site from slightly toward the equator so the pole reads in perspective
      const dist = camera.position.length();
      const lat = site.lat < -60 ? site.lat + 25 : site.lat > 60 ? site.lat - 25 : site.lat;
      const to = toThree(lat, site.lon, dist);
      if (reducedMotion) { camera.position.copy(to); camera.lookAt(0, 0, 0); controls.update(); dirty = true; return; }
      tween = { from: camera.position.clone(), to, dist, t0: performance.now() };
    },
  };
}
