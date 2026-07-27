'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDemoLevel, TuğlaEngine, type EngineSnapshot } from '@tugla/game-engine';
import type { BonusKind } from '@tugla/shared';
import * as THREE from 'three';

interface DroppedBonus {
  id: string;
  kind: BonusKind;
  x: number;
  y: number;
  mesh: THREE.Mesh;
}

interface ViewState {
  score: number;
  lives: number;
  balls: number;
  combo: number;
  status: EngineSnapshot['status'];
}

const initialState: ViewState = {
  score: 0,
  lives: 5,
  balls: 1,
  combo: 0,
  status: 'READY',
};

const blockColors: Record<string, number> = {
  NORMAL: 0x28d9ff,
  TOUGH: 0x7b6cff,
  ARMORED: 0xffb85c,
  EXPLOSIVE: 0xff4d78,
  ICE: 0x88eaff,
  FIRE: 0xff784e,
  ELECTRIC: 0xeaff65,
  BOSS_CORE: 0xff3ef4,
};

export function GameCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TuğlaEngine | null>(null);
  const [view, setView] = useState(initialState);
  const [muted, setMuted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);
  const pointerStart = useRef<number | null>(null);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const paused = engine.snapshot.status !== 'PAUSED';
    engine.pause(paused);
    setView((current) => ({ ...current, status: engine.snapshot.status }));
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const engine = new TuğlaEngine(createDemoLevel(), { width: 9, height: 16, maxBalls: 500 });
    engineRef.current = engine;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07111f, 0.028);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = window.devicePixelRatio <= 2;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      35,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(4.5, 7.4, 22);
    camera.lookAt(4.5, 8, 0);

    scene.add(new THREE.HemisphereLight(0x81dcff, 0x07111f, 1.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
    keyLight.position.set(-5, 14, 10);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(0x7c5cff, 40, 30);
    accentLight.position.set(9, 4, 5);
    scene.add(accentLight);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 16.5, 0.35),
      new THREE.MeshPhysicalMaterial({
        color: 0x081729,
        roughness: 0.58,
        metalness: 0.42,
        clearcoat: 0.7,
      }),
    );
    board.position.set(4.5, 8, -0.45);
    board.receiveShadow = true;
    scene.add(board);

    const grid = new THREE.GridHelper(18, 36, 0x1f4866, 0x102f49);
    grid.rotation.x = Math.PI / 2;
    grid.position.set(4.5, 8, -0.24);
    scene.add(grid);

    const blockGeometry = new THREE.BoxGeometry(1, 1, 0.46, 2, 2, 1);
    const blockMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      vertexColors: true,
    });
    const blockMesh = new THREE.InstancedMesh(
      blockGeometry,
      blockMaterial,
      engine.snapshot.blocks.length,
    );
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;
    blockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(blockMesh);

    const ballGeometry = new THREE.SphereGeometry(0.105, 14, 10);
    const ballMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xeefcff,
      emissive: 0x38d9ff,
      emissiveIntensity: 1.4,
      roughness: 0.08,
      metalness: 0.25,
      clearcoat: 1,
    });
    const ballMesh = new THREE.InstancedMesh(ballGeometry, ballMaterial, 500);
    ballMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(ballMesh);

    const paddle = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 0.55),
      new THREE.MeshPhysicalMaterial({
        color: 0x4ce9ff,
        emissive: 0x124bff,
        emissiveIntensity: 0.8,
        metalness: 0.65,
        roughness: 0.18,
        clearcoat: 1,
      }),
    );
    paddle.castShadow = true;
    scene.add(paddle);

    const bonusGeometry = new THREE.CapsuleGeometry(0.16, 0.2, 6, 10);
    const bonuses: DroppedBonus[] = [];
    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempScale = new THREE.Vector3();
    const tempQuaternion = new THREE.Quaternion();
    const clock = new THREE.Clock();
    let animationFrame = 0;
    let hudAccumulator = 0;

    engine.snapshot.blocks.forEach((block, index) => {
      blockMesh.setColorAt(index, new THREE.Color(blockColors[block.kind] ?? 0x37d4ff));
    });
    blockMesh.instanceColor!.needsUpdate = true;

    const applyBonus = (kind: BonusKind) => {
      if (kind === 'BALL_DOUBLE') engine.addBalls(engine.snapshot.balls.length);
      else if (kind === 'BALL_5') engine.addBalls(5);
      else if (kind === 'BALL_3') engine.addBalls(3);
      else if (kind === 'BALL_1') engine.addBalls(1);
      else if (kind === 'PADDLE_GROW')
        engine.snapshot.paddle.width = Math.min(3.4, engine.snapshot.paddle.width + 0.45);
      else if (kind === 'SHIELD') engine.snapshot.paddle.shield = 100;
      else engine.snapshot.balls.forEach((ball) => ball.effects.add(kind));
    };

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      engine.update(delta);

      for (const event of engine.drainEvents()) {
        if (event.type !== 'BONUS_DROPPED') continue;
        const block = engine.snapshot.blocks.find((item) => item.id === event.entityId);
        if (!block?.bonus) continue;
        const material = new THREE.MeshPhysicalMaterial({
          color: 0x94ffef,
          emissive: 0x2bdcff,
          emissiveIntensity: 1.4,
          roughness: 0.18,
          metalness: 0.4,
        });
        const mesh = new THREE.Mesh(bonusGeometry, material);
        mesh.position.set(block.position.x, block.position.y, 0.6);
        scene.add(mesh);
        bonuses.push({
          id: `${block.id}-${event.tick}`,
          kind: block.bonus,
          x: block.position.x,
          y: block.position.y,
          mesh,
        });
      }

      bonuses.forEach((bonus) => {
        bonus.y -= delta * 2.15;
        bonus.mesh.position.y = bonus.y;
        bonus.mesh.rotation.y += delta * 4;
        bonus.mesh.rotation.z += delta * 1.7;
        const paddleState = engine.snapshot.paddle;
        if (
          bonus.y <= paddleState.y + 0.35 &&
          bonus.y >= paddleState.y - 0.35 &&
          Math.abs(bonus.x - paddleState.x) <= paddleState.width / 2 + 0.2
        ) {
          applyBonus(bonus.kind);
          bonus.y = -10;
        }
      });
      for (let index = bonuses.length - 1; index >= 0; index -= 1) {
        const bonus = bonuses[index];
        if (bonus && bonus.y < -1) {
          scene.remove(bonus.mesh);
          (bonus.mesh.material as THREE.Material).dispose();
          bonuses.splice(index, 1);
        }
      }

      engine.snapshot.blocks.forEach((block, index) => {
        tempPosition.set(block.position.x, block.position.y, 0.1);
        tempScale.set(
          block.active ? block.size.x * 0.9 : 0,
          block.active ? block.size.y * 0.82 : 0,
          block.active ? 1 : 0,
        );
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        blockMesh.setMatrixAt(index, tempMatrix);
      });
      blockMesh.instanceMatrix.needsUpdate = true;

      const activeBalls = engine.snapshot.balls;
      ballMesh.count = activeBalls.length;
      activeBalls.forEach((ball, index) => {
        const lastBallScale = activeBalls.length === 1 ? 1.16 : 1;
        tempPosition.set(ball.position.x, ball.position.y, 0.5);
        tempScale.setScalar(lastBallScale);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        ballMesh.setMatrixAt(index, tempMatrix);
      });
      ballMesh.instanceMatrix.needsUpdate = true;

      const paddleState = engine.snapshot.paddle;
      paddle.position.set(paddleState.x, paddleState.y, 0.34);
      paddle.scale.set(paddleState.width, paddleState.height, 1);

      hudAccumulator += delta;
      if (hudAccumulator > 0.08) {
        hudAccumulator = 0;
        setView({
          score: engine.snapshot.score,
          lives: engine.snapshot.lives,
          balls: activeBalls.length,
          combo: engine.snapshot.combo,
          status: engine.snapshot.status,
        });
      }
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(tick);
    };
    tick();

    const resize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const pointerX = (clientX: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * engine.width;
    };
    const pointerDown = (event: PointerEvent) => {
      pointerStart.current = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
      engine.setPaddleTarget(pointerX(event.clientX));
    };
    const pointerMove = (event: PointerEvent) => {
      if (pointerStart.current === null) return;
      engine.setPaddleTarget(pointerX(event.clientX));
      if (
        engine.snapshot.status === 'READY' &&
        Math.abs(event.clientX - pointerStart.current) > 18
      ) {
        engine.launch();
        setHelpOpen(false);
      }
    };
    const pointerUp = (event: PointerEvent) => {
      if (engine.snapshot.status === 'READY') {
        engine.setPaddleTarget(pointerX(event.clientX));
        engine.launch();
        setHelpOpen(false);
      }
      pointerStart.current = null;
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a')
        engine.setPaddleTarget(engine.snapshot.paddle.targetX - 0.7);
      if (event.key === 'ArrowRight' || event.key === 'd')
        engine.setPaddleTarget(engine.snapshot.paddle.targetX + 0.7);
      if (event.key === ' ' && engine.snapshot.status === 'READY') engine.launch();
      if (event.key === 'Escape') {
        engine.pause(engine.snapshot.status !== 'PAUSED');
      }
    };
    const visibility = () => {
      if (document.hidden) engine.pause(true);
    };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keyDown);
    document.addEventListener('visibilitychange', visibility);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keyDown);
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.dispose();
      blockGeometry.dispose();
      blockMaterial.dispose();
      ballGeometry.dispose();
      ballMaterial.dispose();
      bonusGeometry.dispose();
      mount.removeChild(renderer.domElement);
      engineRef.current = null;
    };
  }, []);

  return (
    <section className="game-shell">
      <header className="game-topbar">
        <a className="brand game-brand" href="/">
          <span className="brand-mark" />
          TUĞLA
        </a>
        <div className="level-title">
          <span>WORLD 01 · NEON GRID</span>
          <strong>LEVEL 01</strong>
        </div>
        <div className="game-controls">
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label="Sesi aç veya kapat"
          >
            {muted ? 'SOUND OFF' : 'SOUND ON'}
          </button>
          <button type="button" onClick={togglePause}>
            {view.status === 'PAUSED' ? 'DEVAM' : 'DURAKLAT'}
          </button>
        </div>
      </header>

      <div className="game-stage">
        <aside className="hud-panel">
          <span>SCORE</span>
          <strong>{view.score.toLocaleString('tr-TR')}</strong>
          <span>COMBO</span>
          <strong className="accent">×{Math.max(1, Math.floor(view.combo / 5) + 1)}</strong>
        </aside>

        <div className="canvas-frame">
          <div ref={mountRef} className="game-canvas" />
          {helpOpen && (
            <div className="game-instruction">
              <span>↔</span>
              <strong>PLATFORMU HAREKET ETTİR</strong>
              <p>İlk hareketin topun çıkış açısını belirler.</p>
            </div>
          )}
          {(view.status === 'PAUSED' ||
            view.status === 'COMPLETED' ||
            view.status === 'FAILED') && (
            <div className="game-overlay">
              <span>{view.status === 'PAUSED' ? 'SESSION PAUSED' : 'SESSION COMPLETE'}</span>
              <h1>
                {view.status === 'PAUSED'
                  ? 'Ritmi dondurdun.'
                  : view.status === 'COMPLETED'
                    ? 'Çekirdek temizlendi.'
                    : 'Enerji tükendi.'}
              </h1>
              {view.status === 'PAUSED' && (
                <button className="button button-primary" onClick={togglePause}>
                  Devam et
                </button>
              )}
              {view.status !== 'PAUSED' && (
                <button className="button button-primary" onClick={() => window.location.reload()}>
                  Yeniden başlat
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="hud-panel hud-panel-right">
          <span>LIVES</span>
          <strong>{'♥'.repeat(Math.max(0, view.lives))}</strong>
          <span>ACTIVE BALLS</span>
          <strong className="accent">{view.balls}</strong>
          <div className="progress-track">
            <i style={{ width: `${Math.min(100, (view.score / 10_000) * 100)}%` }} />
          </div>
        </aside>
      </div>

      <footer className="game-footer">
        <span>DRAG / MOUSE / ← →</span>
        <span>WebGL 2 · FIXED 120 HZ PHYSICS</span>
        <span>MAX 500 BALLS</span>
      </footer>
    </section>
  );
}
