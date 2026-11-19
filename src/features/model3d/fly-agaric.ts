// code-guard: intentional-duplicate - geometry helper names (profile, ring, cap) are local to this model; no other 3D code in the app.
import * as THREE from 'three';

/**
 * Proportions follow the morphology in Wikipedia PL "Muchomor czerwony" (rev. 81075418, also shown on the species card):
 * mature cap low-arched to flat, stem cylindrical and about as tall as the cap is wide, white hanging ring,
 * white crowded free gills, bulbous base ringed with a few roll-like bands and no distinct volva, white warts on the cap.
 * One unit ≈ 10 cm. Everything is procedural: no texture or model file ships with the app.
 */
const CAP_R = 0.62;
const CAP_RIM_Y = 1.36;
const CAP_TOP_Y = 1.6;
const STEM_TOP_R = 0.085;
const STEM_LOW_R = 0.1;
const RING_Y = 1.18;
const BULB_R = 0.2;
const BULB_MID = 0.13; // widest point of the bulb
const BULB_TOP = 0.34; // where the bulb narrows into the stem

export type PartName = 'cap' | 'warts' | 'gills' | 'ring' | 'stem' | 'bulb';

/** Deterministic pseudo-random numbers so the warts look the same on every render and in tests. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Height of the cap's upper surface at distance r from the axis (flattened dome, rim slightly turned down). */
function capTopY(r: number): number {
  const t = Math.min(1, r / CAP_R);
  return CAP_RIM_Y + (CAP_TOP_Y - CAP_RIM_Y) * Math.cos((t * Math.PI) / 2) ** 1.4;
}

/** Height of the cap's underside (where the gills hang from): rises from the rim towards the stem. */
function capUnderY(r: number): number {
  const t = Math.min(1, r / CAP_R);
  return CAP_RIM_Y + 0.1 * (1 - t * t);
}

/** Stem radius at height y: slightly widening downwards, then the bulb. */
function stemRadius(y: number): number {
  if (y > BULB_TOP) return STEM_LOW_R + (STEM_TOP_R - STEM_LOW_R) * ((y - BULB_TOP) / (CAP_RIM_Y + 0.1 - BULB_TOP));
  if (y > BULB_MID) {
    const t = Math.max(0, y - BULB_MID) / (BULB_TOP - BULB_MID);
    return BULB_R + (STEM_LOW_R - BULB_R) * t * t * (3 - 2 * t);
  }
  // rounded underside of the bulb (half-ellipse)
  return BULB_R * Math.sqrt(Math.max(0, 1 - ((BULB_MID - y) / BULB_MID) ** 2));
}

function lathe(points: [number, number][], segments = 48): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

/**
 * RESPONSIBILITY: Wierzchnia skórka kapelusza (bryła obrotowa) z kolorem od ciemnej czerwieni w środku do pomarańczowej przy brzegu
 * INPUTS:         none
 * OUTPUTS:        BufferGeometry z atrybutem color
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function capGeometry(): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const r = CAP_R * i / 24;
    pts.push([r, capTopY(r)]);
  }
  // Rim edge rolls under the cap so the red skin has visible thickness from the side.
  pts.push([CAP_R + 0.012, CAP_RIM_Y - 0.02], [CAP_R - 0.02, CAP_RIM_Y - 0.03]);
  const geo = lathe(pts, 64);
  // Vertex colours: deep red in the centre, orange-red towards the rim (as in most photos of mature caps).
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const centre = new THREE.Color('#B3191A');
  const rim = new THREE.Color('#E0522B');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i)) / CAP_R;
    c.copy(centre).lerp(rim, Math.min(1, r) ** 2);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function capUndersideGeometry(): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const r = CAP_R - 0.02 - ((CAP_R - 0.02 - STEM_TOP_R) * i) / 12;
    pts.push([r, capUnderY(r) - 0.03 + 0.002 * i]);
  }
  return lathe(pts, 64);
}

/**
 * RESPONSIBILITY: Blaszki wolne, gęste, brzuchate: pełne na przemian z krótkimi; żadna nie dotyka trzonu
 * INPUTS:         count: liczba blaszek dookoła (domyślnie 96)
 * OUTPUTS:        BufferGeometry cienkich płytek (rysowanych dwustronnie)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function gillsGeometry(count = 96): THREE.BufferGeometry {
  const verts: number[] = [];
  const steps = 10;
  for (let g = 0; g < count; g++) {
    const a = (g / count) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const r0 = g % 2 === 0 ? STEM_TOP_R + 0.06 : CAP_R * 0.55; // short gills start halfway out
    const r1 = CAP_R - 0.03;
    const depth = g % 2 === 0 ? 0.09 : 0.06;
    let prev: [number, number, number, number] | null = null;
    for (let i = 0; i <= steps; i++) {
      const r = r0 + ((r1 - r0) * i) / steps;
      const top = capUnderY(r) - 0.03;
      const bottom = top - depth * Math.sin((Math.PI * i) / steps) ** 0.8;
      if (prev) {
        const [pr, pt, , pb] = prev;
        verts.push(pr * ca, pt, pr * sa, r * ca, top, r * sa, pr * ca, pb, pr * sa);
        verts.push(r * ca, top, r * sa, r * ca, bottom, r * sa, pr * ca, pb, pr * sa);
      }
      prev = [r, top, 0, bottom];
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function stemGeometry(): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.0, 0.0]];
  for (let i = 0; i <= 40; i++) {
    const y = i * (CAP_RIM_Y + 0.08) / 40;
    pts.push([stemRadius(y), y]);
  }
  return lathe(pts, 40);
}

/** Hanging skirt-like ring with a slightly wavy lower edge. */
function ringGeometry(): THREE.BufferGeometry {
  const len = 0.2;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push([stemRadius(RING_Y) + 0.004 + 0.075 * Math.sin((t * Math.PI) / 2), RING_Y - len * t]);
  }
  const geo = lathe(pts, 64);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const t = Math.max(0, RING_Y - pos.getY(i)) / len;
    const k = 1 + 0.12 * t * Math.sin(9 * Math.atan2(z, x));
    pos.setXYZ(i, x * k, pos.getY(i), z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Roll-like bands around the upper part of the bulb (remains of the universal veil). */
function bulbBands(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  [0.3, 0.24, 0.18].forEach((y, i) => {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(stemRadius(y) + 0.004, 0.018 - i * 0.002, 6, 40), material);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = y;
    group.add(torus);
  });
  return group;
}

/** White warts scattered over the cap, flattened and tilted to follow the surface. */
function warts(material: THREE.Material, count = 70): THREE.InstancedMesh {
  const rand = seeded(42);
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    // sqrt keeps the density even over the area; stop short of the rim where warts wash off first
    const r = CAP_R * 0.93 * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    const dr = 0.002;
    const slope = capTopY(r + dr) / dr - capTopY(r) / dr;
    const normal = new THREE.Vector3(-slope * Math.cos(a), 1, -slope * Math.sin(a)).normalize();
    q.setFromUnitVectors(up, normal);
    const size = 0.022 + 0.03 * rand();
    m.compose(new THREE.Vector3(r * Math.cos(a), capTopY(r) + 0.004, r * Math.sin(a)), q, new THREE.Vector3(size, size * 0.32, size * (0.8 + 0.4 * rand())));
    mesh.setMatrixAt(i, m);
  }
  return mesh;
}

/** Matte double-sided material for the white parts (gills and the ring are seen from both sides). */
function matte(hex: string, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: hex, roughness, side: THREE.DoubleSide });
}

/**
 * RESPONSIBILITY: Proceduralny model 3D muchomora czerwonego z nazwanymi częściami (kapelusz, łatki, blaszki, pierścień, trzon, bulwa)
 * INPUTS:         none (proporcje ze stałych opartych o opis morfologii z Wikipedii PL)
 * OUTPUTS:        THREE.Group; każda część ma `name` z PartName, żeby widok mógł ją podświetlić albo zamienić materiał na cień
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (tylko geometria w pamięci; wywołujący zwalnia ją przez disposeModel)
 * ERRORS:         none
 */
export function buildFlyAgaric(): THREE.Group {
  const white = matte;
  const root = new THREE.Group();

  const cap = new THREE.Group();
  cap.name = 'cap';
  cap.add(new THREE.Mesh(capGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, side: THREE.DoubleSide })));
  cap.add(new THREE.Mesh(capUndersideGeometry(), white('#EDE3C8')));
  root.add(cap);

  const wartMesh = warts(white('#F6F1E2', 0.95));
  wartMesh.name = 'warts';
  root.add(wartMesh);

  const gills = new THREE.Mesh(gillsGeometry(), white('#F8F2DF', 0.9));
  gills.name = 'gills';
  root.add(gills);

  const ring = new THREE.Mesh(ringGeometry(), white('#F7F2E4', 0.9));
  ring.name = 'ring';
  root.add(ring);

  const stem = new THREE.Mesh(stemGeometry(), white('#F1EADA'));
  stem.name = 'stem';
  root.add(stem);

  const bulb = bulbBands(white('#E9E0C9', 0.95));
  bulb.name = 'bulb';
  root.add(bulb);

  return root;
}

/** Height of the model in scene units (ground to cap top), used to frame the camera. */
export const FLY_AGARIC_HEIGHT = CAP_TOP_Y;

/**
 * RESPONSIBILITY: Zwalnia geometrie i materiały modelu (pamięć GPU) po odmontowaniu widoku
 * INPUTS:         root: THREE.Object3D zbudowany przez buildFlyAgaric
 * OUTPUTS:        none
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        GPU (dispose buforów)
 * ERRORS:         none
 */
export function disposeModel(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    }
  });
}
