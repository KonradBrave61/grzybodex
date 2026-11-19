// code-guard: intentional-duplicate - test-local names (model, names, box) fuzzy-match unrelated code.
import * as THREE from 'three';

import { buildFlyAgaric, disposeModel, FLY_AGARIC_HEIGHT } from '../fly-agaric';

function triangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    const per = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    n += per * (o instanceof THREE.InstancedMesh ? o.count : 1);
  });
  return n;
}

describe('buildFlyAgaric', () => {
  const model = buildFlyAgaric();
  model.updateMatrixWorld(true);

  it('has every part named after a feature from the description', () => {
    expect(model.children.map((c) => c.name).sort()).toEqual(['bulb', 'cap', 'gills', 'ring', 'stem', 'warts']);
  });

  it('stands on the ground and is about as tall as declared', () => {
    const box = new THREE.Box3().setFromObject(model);
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeGreaterThan(FLY_AGARIC_HEIGHT - 0.01);
    expect(box.max.y).toBeLessThan(FLY_AGARIC_HEIGHT + 0.08); // warts sit on top of the cap
    // the cap is about as wide as the stem is tall (both up to 20 cm in the source)
    const ratio = (box.max.x - box.min.x) / box.max.y;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1);
  });

  it('keeps the gills free: no gill vertex touches the stem', () => {
    const gills = model.getObjectByName('gills') as THREE.Mesh;
    const pos = gills.geometry.getAttribute('position');
    let minR = Infinity;
    for (let i = 0; i < pos.count; i++) minR = Math.min(minR, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(minR).toBeGreaterThan(0.12);
  });

  it('places the ring below the cap, hanging around the stem', () => {
    const ring = new THREE.Box3().setFromObject(model.getObjectByName('ring')!);
    const cap = new THREE.Box3().setFromObject(model.getObjectByName('cap')!);
    expect(ring.max.y).toBeLessThan(cap.min.y);
    expect(ring.min.y).toBeGreaterThan(0.5);
  });

  it('is deterministic and small enough for a phone', () => {
    const again = buildFlyAgaric();
    const a = (model.getObjectByName('warts') as THREE.InstancedMesh).instanceMatrix.array;
    const b = (again.getObjectByName('warts') as THREE.InstancedMesh).instanceMatrix.array;
    expect(Array.from(b)).toEqual(Array.from(a));
    expect(triangles(model)).toBeLessThan(30000);
    disposeModel(again);
  });
});
