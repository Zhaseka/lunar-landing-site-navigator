// Photoreal Moon built from NASA's CGI Moon Kit (LRO LROC colour mosaic and
// LOLA elevation), lit by a directional "Sun" with no atmosphere.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
let colorTex, bumpTex;

function textures(hi) {
  if (!colorTex) {
    colorTex = loader.load(hi ? '/textures/moon_4k.jpg' : '/textures/lroc_color_2k.jpg');
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.anisotropy = 8;
    bumpTex = loader.load('/textures/ldem_3_8bit.jpg');
  }
  return { colorTex, bumpTex };
}

// Moon body frame (x: 0°E on the equator, y: 90°E, z: north) -> three.js (y up)
export function toThree(latDeg, lonDeg, r = 1) {
  const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r);
}

export function createMoon({ hi = true, segments = 160 } = {}) {
  const { colorTex: map, bumpTex: bumpMap } = textures(hi);
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2.2, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, segments / 2), mat);
  // SphereGeometry puts u=0.5 (0° longitude) on +x; turn it to +z to match toThree()
  mesh.rotation.y = -Math.PI / 2;
  const group = new THREE.Group();
  group.add(mesh);

  const sun = new THREE.DirectionalLight(0xfff4e2, 3.2);
  const fill = new THREE.AmbientLight(0x8aa4ff, 0.035); // faint earthshine
  group.add(sun, sun.target, fill);

  return {
    group,
    setSun(subSolar) {
      sun.position.copy(toThree(subSolar.lat, subSolar.lon, 10));
    },
  };
}

export function createStars(count = 1800, radius = 40) {
  const pos = new Float32Array(count * 3), size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(t) * radius, u * radius, s * Math.sin(t) * radius], i * 3);
    size[i] = Math.random() ** 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float size; varying float vA; void main(){ vA = 0.35 + 0.65*size; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = (1.0 + 2.2*size) * (300.0 / 300.0); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vec3(0.92,0.94,1.0), vA*smoothstep(0.5,0.0,d)); }',
  });
  return new THREE.Points(geo, mat);
}
