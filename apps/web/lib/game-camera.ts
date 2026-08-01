import { MathUtils, Plane, Raycaster, Vector2, Vector3, type PerspectiveCamera } from 'three';

const CAMERA_FOV = 35;
const CAMERA_NEAR = 0.1;
const MINIMUM_CAMERA_FAR = 100;

// The board mesh extends 0.25 units past the physics area. The remaining
// margin keeps gameplay objects clear of the viewport edge.
const FRAME_PADDING_X = 0.5;
const FRAME_PADDING_Y = 0.5;

// Covers the board back face through the front of bonuses, balls and paddle.
const FRAME_BACK_Z = -0.65;
const FRAME_FRONT_Z = 0.8;

// Preserve the subtle upward viewing angle of the original camera
// (position y=7.36, target y=8, z=22) while making its distance responsive.
const CAMERA_TILT = Math.atan2(0.64, 22);

export interface GameCameraFrame {
  aspect: number;
  distance: number;
  positionY: number;
  positionZ: number;
  targetX: number;
  targetY: number;
}

interface FitGameCameraOptions {
  boardWidth: number;
  boardHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

/** Fits the complete 3D board bounds into a perspective camera frustum. */
export function fitGameCamera(
  camera: PerspectiveCamera,
  { boardWidth, boardHeight, viewportWidth, viewportHeight }: FitGameCameraOptions,
): GameCameraFrame {
  const fallbackAspect = boardWidth / boardHeight;
  const measuredAspect = viewportWidth / viewportHeight;
  const aspect =
    viewportWidth > 0 && viewportHeight > 0 && Number.isFinite(measuredAspect)
      ? measuredAspect
      : fallbackAspect;

  const halfWidth = boardWidth / 2 + FRAME_PADDING_X;
  const halfHeight = boardHeight / 2 + FRAME_PADDING_Y;
  const verticalTangent = Math.tan(MathUtils.degToRad(CAMERA_FOV / 2));
  const horizontalTangent = verticalTangent * aspect;
  const tiltSin = Math.sin(CAMERA_TILT);
  const tiltCos = Math.cos(CAMERA_TILT);

  let distance = 0;
  for (const relativeY of [-halfHeight, halfHeight]) {
    for (const z of [FRAME_BACK_Z, FRAME_FRONT_Z]) {
      const vertical = relativeY * tiltCos + z * tiltSin;
      const depthOffset = relativeY * tiltSin - z * tiltCos;
      distance = Math.max(
        distance,
        Math.abs(vertical) / verticalTangent - depthOffset,
        halfWidth / horizontalTangent - depthOffset,
      );
    }
  }

  const targetX = boardWidth / 2;
  const targetY = boardHeight / 2;
  const positionY = targetY - distance * tiltSin;
  const positionZ = distance * tiltCos;

  camera.fov = CAMERA_FOV;
  camera.aspect = aspect;
  camera.near = CAMERA_NEAR;
  camera.far = Math.max(MINIMUM_CAMERA_FAR, distance + boardHeight * 2);
  camera.position.set(targetX, positionY, positionZ);
  camera.lookAt(targetX, targetY, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  return { aspect, distance, positionY, positionZ, targetX, targetY };
}

/** The paddle sits slightly in front of the board; pointers project onto it. */
export const PADDLE_PLANE_Z = 0.34;

export interface PointerProjectionInput {
  camera: PerspectiveCamera;
  /** Bounding box of the canvas in client coordinates. */
  rect: { left: number; top: number; width: number; height: number };
  clientX: number;
  clientY?: number;
  boardWidth: number;
}

const projectionRaycaster = new Raycaster();
const projectionPlane = new Plane(new Vector3(0, 0, 1), -PADDLE_PLANE_Z);
const projectionHit = new Vector3();
const projectionNdc = new Vector2();

/**
 * Maps a screen position onto the paddle plane.
 *
 * Treating the canvas width as the board width is wrong whenever the camera
 * letterboxes the field — the paddle then trails the finger, which is exactly
 * how it reached production. Ray-casting through the actual camera keeps the
 * paddle under the pointer at any aspect ratio, and the result is clamped so a
 * pointer dragged off-canvas parks the paddle at the wall instead of beyond it.
 */
export function projectPointerToBoardX({
  camera,
  rect,
  clientX,
  clientY,
  boardWidth,
}: PointerProjectionInput): number {
  if (rect.width === 0 || rect.height === 0) return boardWidth / 2;

  const y = clientY ?? rect.top + rect.height * 0.85;
  projectionNdc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((y - rect.top) / rect.height) * 2 + 1,
  );
  projectionRaycaster.setFromCamera(projectionNdc, camera);
  const hit = projectionRaycaster.ray.intersectPlane(projectionPlane, projectionHit);
  if (!hit) return boardWidth / 2;
  return Math.min(boardWidth, Math.max(0, hit.x));
}
