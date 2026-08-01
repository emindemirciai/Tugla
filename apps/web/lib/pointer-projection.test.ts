import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { fitGameCamera, projectPointerToBoardX } from './game-camera';

const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 16;

/** Camera set up exactly like the game does for a given viewport. */
const cameraFor = (viewportWidth: number, viewportHeight: number) => {
  const camera = new PerspectiveCamera();
  fitGameCamera(camera, {
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    viewportWidth,
    viewportHeight,
  });
  return camera;
};

const rectFor = (width: number, height: number) => ({ left: 0, top: 0, width, height });

describe('pointer projection', () => {
  it('puts the paddle under the pointer at the centre of the canvas', () => {
    const camera = cameraFor(390, 700);
    const x = projectPointerToBoardX({
      camera,
      rect: rectFor(390, 700),
      clientX: 195,
      clientY: 600,
      boardWidth: BOARD_WIDTH,
    });
    expect(x).toBeCloseTo(BOARD_WIDTH / 2, 1);
  });

  it('tracks the pointer monotonically from left to right', () => {
    const camera = cameraFor(390, 700);
    const rect = rectFor(390, 700);
    const samples = [40, 120, 195, 270, 350].map((clientX) =>
      projectPointerToBoardX({ camera, rect, clientX, clientY: 600, boardWidth: BOARD_WIDTH }),
    );
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]!).toBeGreaterThan(samples[index - 1]!);
    }
  });

  /**
   * The regression that shipped: mapping canvas width straight onto the board
   * made the paddle move a fraction of the pointer's travel on a tall phone,
   * where the camera letterboxes the field. A correct projection covers most of
   * the board across the visible field.
   */
  it('does not lag behind the pointer on a tall phone viewport', () => {
    const camera = cameraFor(390, 780);
    const rect = rectFor(390, 780);
    const naive = (clientX: number) => (clientX / 390) * BOARD_WIDTH;

    const leftEdge = projectPointerToBoardX({
      camera,
      rect,
      clientX: 20,
      clientY: 650,
      boardWidth: BOARD_WIDTH,
    });
    const rightEdge = projectPointerToBoardX({
      camera,
      rect,
      clientX: 370,
      clientY: 650,
      boardWidth: BOARD_WIDTH,
    });

    // Travel must be at least as large as the naive mapping, never smaller.
    expect(rightEdge - leftEdge).toBeGreaterThanOrEqual(naive(370) - naive(20));
  });

  it('clamps to the board instead of running past the wall', () => {
    const camera = cameraFor(390, 700);
    const rect = rectFor(390, 700);
    expect(
      projectPointerToBoardX({
        camera,
        rect,
        clientX: -400,
        clientY: 600,
        boardWidth: BOARD_WIDTH,
      }),
    ).toBe(0);
    expect(
      projectPointerToBoardX({ camera, rect, clientX: 900, clientY: 600, boardWidth: BOARD_WIDTH }),
    ).toBe(BOARD_WIDTH);
  });

  it('falls back to the centre when the canvas has no size yet', () => {
    expect(
      projectPointerToBoardX({
        camera: cameraFor(390, 700),
        rect: rectFor(0, 0),
        clientX: 100,
        boardWidth: BOARD_WIDTH,
      }),
    ).toBe(BOARD_WIDTH / 2);
  });
});
