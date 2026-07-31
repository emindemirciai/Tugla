import { Frustum, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fitGameCamera } from './game-camera';

const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 16;

const VIEWPORTS = [
  { name: 'mobile portrait', width: 390, height: 844 },
  { name: 'tablet portrait', width: 1024, height: 1366 },
  { name: 'desktop widescreen', width: 1920, height: 1080 },
  { name: 'desktop ultrawide', width: 2560, height: 1080 },
] as const;

function cameraFrustum(camera: PerspectiveCamera) {
  const projectionView = new Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  return new Frustum().setFromProjectionMatrix(projectionView);
}

function requiredGameplayPoints() {
  const points = [
    // Physics board bounds, including the lower edge hidden by the old framing.
    new Vector3(0, 0, 0),
    new Vector3(BOARD_WIDTH, 0, 0),
    new Vector3(0, BOARD_HEIGHT, 0),
    new Vector3(BOARD_WIDTH, BOARD_HEIGHT, 0),
    // Ready ball and representative front faces at the lower and upper board edges.
    new Vector3(BOARD_WIDTH / 2, 1.05, 0.62),
    new Vector3(0, BOARD_HEIGHT, 0.33),
    new Vector3(BOARD_WIDTH, BOARD_HEIGHT, 0.33),
  ];

  // The rendered board is 0.5 units wider/taller than the physics area.
  for (const x of [-0.25, BOARD_WIDTH + 0.25]) {
    for (const y of [-0.25, BOARD_HEIGHT + 0.25]) {
      for (const z of [-0.625, -0.275]) points.push(new Vector3(x, y, z));
    }
  }

  // Initial paddle bounds: center=(4.5, 0.7, 0.34), size=(1.8, 0.22, 0.55).
  for (const x of [3.6, 5.4]) {
    for (const y of [0.59, 0.81]) {
      for (const z of [0.065, 0.615]) points.push(new Vector3(x, y, z));
    }
  }
  return points;
}

describe('game camera framing', () => {
  it.each(VIEWPORTS)('keeps the complete 9x16 board visible on $name', (viewport) => {
    const camera = new PerspectiveCamera();
    fitGameCamera(camera, {
      boardWidth: BOARD_WIDTH,
      boardHeight: BOARD_HEIGHT,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    });

    const frustum = cameraFrustum(camera);
    for (const point of requiredGameplayPoints()) {
      expect(frustum.containsPoint(point), `${point.toArray()} should be visible`).toBe(true);
    }
  });

  it('moves the camera back when a resize makes the viewport narrower', () => {
    const camera = new PerspectiveCamera();
    const desktop = fitGameCamera(camera, {
      boardWidth: BOARD_WIDTH,
      boardHeight: BOARD_HEIGHT,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
    const mobile = fitGameCamera(camera, {
      boardWidth: BOARD_WIDTH,
      boardHeight: BOARD_HEIGHT,
      viewportWidth: 390,
      viewportHeight: 844,
    });

    expect(mobile.distance).toBeGreaterThan(desktop.distance);
    const frustum = cameraFrustum(camera);
    for (const point of requiredGameplayPoints()) {
      expect(frustum.containsPoint(point), `${point.toArray()} should be visible`).toBe(true);
    }
  });
});
