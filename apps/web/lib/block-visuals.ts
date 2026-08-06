import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** One shared, instanced geometry: rounded highlights without changing block bounds. */
export function createBlockGeometry() {
  const geometry = new RoundedBoxGeometry(1, 1, 0.46, 2, 0.075);
  geometry.translate(0, 0, 0.02);
  return geometry;
}
