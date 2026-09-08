import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BURGER_LAYERS, BurgerLayer, LayerName } from '../../data/burgerLayers';

const MODEL_PATH = '/models/burger-final.glb';

export const BURGER_STORY_PHASES = {
  HERO_END: 0.08,
  CENTERING_END: 0.18,
  CENTER_HOLD_END: 0.23,
  EXPLOSION_END: 0.40,
  CROSSOVER_END: 0.43,
  REBUILD_END: 0.92,
  FINAL_SETTLE_END: 0.96,
  FINAL_END: 1,
} as const;

export type StoryLayerTiming = {
  buildStart: number;
  buildEnd: number;
  lineStart: number;
  textStart: number;
};

export function getStoryLayerTiming(index: number, total: number): StoryLayerTiming {
  const count = Math.max(1, total);
  const rebuildSpan = BURGER_STORY_PHASES.REBUILD_END - BURGER_STORY_PHASES.CROSSOVER_END;
  const slot = rebuildSpan / count;
  const buildStart = BURGER_STORY_PHASES.CROSSOVER_END + index * slot;
  const buildEnd = buildStart + slot * 0.70;

  return {
    buildStart,
    buildEnd,
    lineStart: buildStart + slot * 0.58,
    textStart: buildStart + slot * 0.72,
  };
}

export interface GLBBurgerModelRef {
  presentationGroup: THREE.Group | null;
  setScrollProgress: (value: number) => void;
  getScrollProgress: () => number;
}

interface GLBBurgerModelProps {
  enableIdleAnimation?: boolean;
  scale?: number;
  position?: [number, number, number];
  url?: string;
  activeLayer?: LayerName | null;
  mode?: 'story' | 'configurator';
  progressRef?: React.MutableRefObject<number>;
  onPositionsUpdate?: (
    positions: Record<string, { x: number; y: number; r: number }>,
  ) => void;
  onResolvedLayers?: (layers: BurgerLayer[]) => void;
}

type SavedTransform = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
};

type MotionTarget = {
  /** parent-local delta that produces the intended GLB-root-local explosion */
  explosionDelta: THREE.Vector3;
  /** parent-local delta for the small local rebuild entrance */
  incomingDelta: THREE.Vector3;
  focusUpper: THREE.Vector3;
  focusLower: THREE.Vector3;
  focusActive: THREE.Vector3;
};

const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);

function rangeProgress(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp01((progress - start) / (end - start));
}

function easeInOutCubic(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBackSoft(t: number) {
  // Deliberately softer than the default 1.70158 to avoid cartoon bouncing.
  const c1 = 0.82;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Compute an axis-aligned bounding box in the cloned GLB root's LOCAL space.
 * This is important because generated GLBs often contain internal parent scales
 * (0.01, 100, etc). World-space distances applied directly to object.position
 * can therefore look like no animation at all.
 */
function getRootLocalBounds(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const rootInverse = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Vector3();
  const corners = [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
  ];

  root.traverse((obj: any) => {
    if (!obj.isMesh || !obj.geometry) return;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const b: THREE.Box3 | null = obj.geometry.boundingBox;
    if (!b) return;

    corners[0].set(b.min.x, b.min.y, b.min.z);
    corners[1].set(b.min.x, b.min.y, b.max.z);
    corners[2].set(b.min.x, b.max.y, b.min.z);
    corners[3].set(b.min.x, b.max.y, b.max.z);
    corners[4].set(b.max.x, b.min.y, b.min.z);
    corners[5].set(b.max.x, b.min.y, b.max.z);
    corners[6].set(b.max.x, b.max.y, b.min.z);
    corners[7].set(b.max.x, b.max.y, b.max.z);

    corners.forEach((corner) => {
      tmp.copy(corner).applyMatrix4(obj.matrixWorld).applyMatrix4(rootInverse);
      box.expandByPoint(tmp);
    });
  });

  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(4, 4, 2));
  return box;
}

/**
 * Convert a delta expressed in GLB-root-local coordinates into the target
 * object's PARENT-local coordinates. This fixes the main bug where explosion
 * distances were calculated in camera/world units but written into local
 * positions under scaled Blender parents.
 */
function rootLocalDeltaToParentLocal(
  root: THREE.Object3D,
  object: THREE.Object3D,
  rootLocalDelta: THREE.Vector3,
) {
  const parent = object.parent;
  if (!parent) return rootLocalDelta.clone();

  root.updateWorldMatrix(true, false);
  parent.updateWorldMatrix(true, false);

  const worldA = root.localToWorld(new THREE.Vector3(0, 0, 0));
  const worldB = root.localToWorld(rootLocalDelta.clone());

  const parentA = parent.worldToLocal(worldA.clone());
  const parentB = parent.worldToLocal(worldB.clone());
  return parentB.sub(parentA);
}

function getLayerWorldBoxCenter(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return object.getWorldPosition(new THREE.Vector3());
  return box.getCenter(new THREE.Vector3());
}

export const GLBBurgerModel = forwardRef<GLBBurgerModelRef, GLBBurgerModelProps>(
  (
    {
      enableIdleAnimation = true,
      scale = 1,
      position,
      url = MODEL_PATH,
      activeLayer = null,
      mode = 'story',
      progressRef: externalProgressRef,
      onPositionsUpdate,
      onResolvedLayers,
    },
    ref,
  ) => {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => scene.clone(true), [scene]);

    const presentationRef = useRef<THREE.Group>(null);
    const floatingRef = useRef<THREE.Group>(null);
    const centeringRef = useRef<THREE.Group>(null);
    const internalProgressRef = useRef(0);

    const resolvedNodes = useRef(new Map<string, THREE.Object3D>());
    const resolvedOrder = useRef<BurgerLayer[]>([]);
    const originalTransforms = useRef(new Map<string, SavedTransform>());
    const motionTargets = useRef(new Map<string, MotionTarget>());
    const timings = useRef(new Map<string, StoryLayerTiming>());
    const focusOffsets = useRef(new Map<string, { upper: number; lower: number; active: number }>());
    const anchorLocalPoints = useRef(new Map<string, THREE.Vector3>());
    const anchorWorldRadii = useRef(new Map<string, number>());
    const rootLocalSize = useRef(new THREE.Vector3(4, 4, 2));

    const { size, camera, gl } = useThree();
    const width = Math.max(1, size.width);

    // Desktop-first. Keep small-screen values conservative without changing story math.
    const finalStoryScale = width < 768 ? 0.95 : width < 1024 ? 1.16 : 1.48;
    const finalConfigScale = width < 768 ? 0.88 : width < 1024 ? 1.02 : 1.16;
    const cameraZ = mode === 'story' ? 11.7 : 12.5;

    useEffect(() => {
      resolvedNodes.current.clear();
      resolvedOrder.current = [];
      originalTransforms.current.clear();
      motionTargets.current.clear();
      timings.current.clear();
      anchorLocalPoints.current.clear();
      anchorWorldRadii.current.clear();

      clonedScene.updateWorldMatrix(true, true);

      // Center the COMPLETE imported GLB once. This wrapper never becomes an animation channel.
      const worldBox = new THREE.Box3().setFromObject(clonedScene);
      if (!worldBox.isEmpty() && centeringRef.current) {
        const worldCenter = worldBox.getCenter(new THREE.Vector3());
        const rootWorld = clonedScene.getWorldPosition(new THREE.Vector3());
        // Convert the world-space center displacement into centeringRef parent-local.
        const parent = centeringRef.current.parent;
        if (parent) {
          const p0 = parent.worldToLocal(rootWorld.clone());
          const p1 = parent.worldToLocal(worldCenter.clone());
          centeringRef.current.position.copy(p0.sub(p1));
        } else {
          centeringRef.current.position.set(-worldCenter.x, -worldCenter.y, -worldCenter.z);
        }
      }

      // Root-local dimensions are safe to use with GLB internal scales.
      const localBox = getRootLocalBounds(clonedScene);
      rootLocalSize.current.copy(localBox.getSize(new THREE.Vector3()));

      const ordered = [...BURGER_LAYERS].sort((a, b) => a.index - b.index);
      const resolved: Array<{ layer: BurgerLayer; object: THREE.Object3D }> = [];

      ordered.forEach((layer) => {
        const object = clonedScene.getObjectByName(layer.objectName);
        if (!object) {
          console.warn('[BurgerStory] unresolved', layer.key, layer.objectName);
          return;
        }
        resolved.push({ layer, object });
      });

      resolvedOrder.current = resolved.map((entry) => entry.layer);

      // Explosion vectors are expressed in GLB-root-local units, then converted
      // to the individual target's parent-local coordinate system.
      const count = Math.max(1, resolved.length);
      const burgerW = Math.max(rootLocalSize.current.x, 0.001);
      const burgerH = Math.max(rootLocalSize.current.y, 0.001);

      resolved.forEach(({ layer, object }, index) => {
        resolvedNodes.current.set(layer.key, object);
        originalTransforms.current.set(layer.key, {
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
          scale: object.scale.clone(),
        });
        timings.current.set(layer.key, getStoryLayerTiming(index, count));

        const n = count === 1 ? 0.5 : index / (count - 1);
        const side = layer.align === 'left' ? -1 : 1;
        const alternating = index % 2 === 0 ? 1.0 : 0.72;

        // Big, obvious, but still tied to actual burger dimensions.
        const rootExplosion = new THREE.Vector3(
          side * burgerW * 0.72 * alternating,
          THREE.MathUtils.lerp(-burgerH * 0.34, burgerH * 0.42, n),
          (index % 3 - 1) * rootLocalSize.current.z * 0.10,
        );

        const rootIncoming = new THREE.Vector3(
          0,
          burgerH * 0.10,
          0,
        );

        motionTargets.current.set(layer.key, {
          explosionDelta: rootLocalDeltaToParentLocal(clonedScene, object, rootExplosion),
          incomingDelta: rootLocalDeltaToParentLocal(clonedScene, object, rootIncoming),
          focusUpper: rootLocalDeltaToParentLocal(clonedScene, object, new THREE.Vector3(0, burgerH * 0.13, 0)),
          focusLower: rootLocalDeltaToParentLocal(clonedScene, object, new THREE.Vector3(0, -burgerH * 0.13, 0)),
          focusActive: rootLocalDeltaToParentLocal(clonedScene, object, new THREE.Vector3(0, 0, rootLocalSize.current.z * 0.15)),
        });

        focusOffsets.current.set(layer.key, { upper: 0, lower: 0, active: 0 });

        // Store a local point corresponding to the visible bounding-box center.
        const worldCenter = getLayerWorldBoxCenter(object);
        const localCenter = object.worldToLocal(worldCenter.clone());
        anchorLocalPoints.current.set(layer.key, localCenter);

        const objectBox = new THREE.Box3().setFromObject(object);
        const objectSize = objectBox.getSize(new THREE.Vector3());
        anchorWorldRadii.current.set(layer.key, Math.max(objectSize.x, objectSize.z, 0.02) * 0.5);
      });

      console.info('[BurgerStory] ready', {
        configured: BURGER_LAYERS.length,
        resolved: resolved.length,
        rootLocalSize: rootLocalSize.current.toArray(),
        timings: resolved.map(({ layer }, index) => ({
          key: layer.key,
          ...getStoryLayerTiming(index, resolved.length),
        })),
      });

      onResolvedLayers?.(resolvedOrder.current);
    }, [clonedScene, onResolvedLayers]);

    useFrame((state) => {
      const progress = mode === 'configurator'
        ? 1
        : clamp01(externalProgressRef?.current ?? internalProgressRef.current);

      const perspective = state.camera as THREE.PerspectiveCamera;
      perspective.position.set(0, 0, cameraZ);
      perspective.lookAt(0, 0, 0);

      if (presentationRef.current) {
        if (mode === 'story') {
          // Burger starts above Hero copy, then moves to center BEFORE explosion.
          const heroY = width < 768 ? 1.45 : 1.85;
          const centerT = rangeProgress(
            progress,
            BURGER_STORY_PHASES.HERO_END,
            BURGER_STORY_PHASES.CENTERING_END,
          );
          const baseY = THREE.MathUtils.lerp(heroY, 0, easeInOutCubic(centerT));
          const heroScale = 0.76;
          const stageScale = THREE.MathUtils.lerp(heroScale, 1, easeInOutCubic(centerT));

          presentationRef.current.position.set(
            position?.[0] ?? 0,
            (position?.[1] ?? 0) + baseY,
            position?.[2] ?? 0,
          );
          presentationRef.current.scale.setScalar(finalStoryScale * scale * stageScale);
        } else {
          presentationRef.current.position.set(
            position?.[0] ?? 0,
            position?.[1] ?? -0.25,
            position?.[2] ?? 0,
          );
          presentationRef.current.scale.setScalar(finalConfigScale * scale);
        }
      }

      let visibleCount = 0;

      resolvedOrder.current.forEach((layer, index) => {
        const object = resolvedNodes.current.get(layer.key);
        const original = originalTransforms.current.get(layer.key);
        const motion = motionTargets.current.get(layer.key);
        const timing = timings.current.get(layer.key);
        if (!object || !original || !motion || !timing) return;

        // PURE / DETERMINISTIC: restore original Blender transform every frame.
        object.position.copy(original.position);
        object.quaternion.copy(original.quaternion);
        object.scale.copy(original.scale);
        object.visible = true;

        if (mode === 'story') {
          if (progress < BURGER_STORY_PHASES.CENTER_HOLD_END) {
            // Hero / center hold = complete burger.
          } else if (progress <= BURGER_STORY_PHASES.EXPLOSION_END) {
            // OBVIOUS explosion. Local delta was derived from GLB-root-local dimensions.
            const t = easeInOutCubic(rangeProgress(
              progress,
              BURGER_STORY_PHASES.CENTER_HOLD_END,
              BURGER_STORY_PHASES.EXPLOSION_END,
            ));
            object.position.copy(original.position).addScaledVector(motion.explosionDelta, t);
          } else if (progress <= BURGER_STORY_PHASES.CROSSOVER_END) {
            object.position.copy(original.position).add(motion.explosionDelta);
          } else {
            // After explosion, rebuild strictly one ingredient at a time.
            if (progress < timing.buildStart) {
              object.visible = false;
            } else if (progress <= timing.buildEnd) {
              const t = rangeProgress(progress, timing.buildStart, timing.buildEnd);
              const eased = easeOutBackSoft(t);
              object.visible = true;
              object.position
                .copy(original.position)
                .addScaledVector(motion.incomingDelta, 1 - eased);

              const revealScale = THREE.MathUtils.lerp(0.86, 1, easeOutCubic(t));
              object.scale.set(
                original.scale.x * revealScale,
                original.scale.y * revealScale,
                original.scale.z * revealScale,
              );
            } else {
              object.visible = true;
            }
          }

          const fOffsets = focusOffsets.current.get(layer.key);
          if (fOffsets) {
            let tUpper = 0, tLower = 0, tActive = 0;
            if (activeLayer && progress >= BURGER_STORY_PHASES.REBUILD_END && object.visible) {
              const activeIndex = resolvedOrder.current.findIndex((l) => l.key === activeLayer);
              if (index > activeIndex) tUpper = 1;
              else if (index < activeIndex) tLower = 1;
              else tActive = 1;
            }

            fOffsets.upper = THREE.MathUtils.lerp(fOffsets.upper, tUpper, 0.1);
            fOffsets.lower = THREE.MathUtils.lerp(fOffsets.lower, tLower, 0.1);
            fOffsets.active = THREE.MathUtils.lerp(fOffsets.active, tActive, 0.1);

            object.position.addScaledVector(motion.focusUpper, fOffsets.upper);
            object.position.addScaledVector(motion.focusLower, fOffsets.lower);
            object.position.addScaledVector(motion.focusActive, fOffsets.active);
          }
        }

        if (object.visible) visibleCount += 1;
      });

      if (import.meta.env.DEV && mode === 'story' && resolvedOrder.current.length && visibleCount === 0) {
        console.error('[BurgerStory] EMPTY FRAME', progress);
      }

      // Presentation rotation is only focus/idle, never the story transform channel.
      if (presentationRef.current) {
        const focusLayer = resolvedOrder.current.find((l) => l.key === activeLayer);
        const targetY = mode === 'story' && activeLayer && progress >= BURGER_STORY_PHASES.REBUILD_END
          ? (focusLayer?.align === 'left' ? -0.2007 : 0.2007)
          : 0;
        presentationRef.current.rotation.y = THREE.MathUtils.lerp(
          presentationRef.current.rotation.y,
          targetY,
          0.09,
        );
      }

      if (floatingRef.current) {
        const reduceMotion = typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const allowIdle = enableIdleAnimation && !reduceMotion && (
          mode === 'configurator' ||
          progress < BURGER_STORY_PHASES.HERO_END ||
          progress > BURGER_STORY_PHASES.FINAL_SETTLE_END
        );
        const t = state.clock.getElapsedTime();
        floatingRef.current.position.y = allowIdle ? Math.sin(t * 0.7) * 0.045 : 0;
        floatingRef.current.rotation.z = allowIdle ? Math.cos(t * 0.43) * 0.005 : 0;
      }

      // Labels only need screen anchors once rebuilding begins (or for final click focus).
      if (
        onPositionsUpdate &&
        presentationRef.current &&
        (mode === 'configurator' || progress >= BURGER_STORY_PHASES.CROSSOVER_END - 0.01)
      ) {
        presentationRef.current.updateWorldMatrix(true, true);
        const rect = gl.domElement.getBoundingClientRect();
        const positions: Record<string, { x: number; y: number; r: number }> = {};

        resolvedOrder.current.forEach((layer) => {
          const object = resolvedNodes.current.get(layer.key);
          const localAnchor = anchorLocalPoints.current.get(layer.key);
          if (!object || !object.visible || !localAnchor) return;

          object.updateWorldMatrix(true, false);
          const world = localAnchor.clone().applyMatrix4(object.matrixWorld);
          const projected = world.clone().project(state.camera);
          if (
            !Number.isFinite(projected.x) ||
            !Number.isFinite(projected.y) ||
            !Number.isFinite(projected.z) ||
            projected.z < -1 ||
            projected.z > 1
          ) return;

          const x = (projected.x * 0.5 + 0.5) * rect.width;
          const y = (-projected.y * 0.5 + 0.5) * rect.height;

          // Estimate radius with a second world-space point along camera X.
          const radiusWorld = anchorWorldRadii.current.get(layer.key) ?? 0.1;
          const rightWorld = world.clone().add(new THREE.Vector3(radiusWorld, 0, 0));
          const rightProjected = rightWorld.project(state.camera);
          const xr = (rightProjected.x * 0.5 + 0.5) * rect.width;

          if (Number.isFinite(x) && Number.isFinite(y)) {
            positions[layer.key] = { x, y, r: Math.max(5, Math.abs(xr - x)) };
          }
        });

        onPositionsUpdate(positions);
      }
    });

    useImperativeHandle(ref, () => ({
      get presentationGroup() {
        return presentationRef.current;
      },
      setScrollProgress(value: number) {
        internalProgressRef.current = clamp01(value);
      },
      getScrollProgress() {
        return externalProgressRef?.current ?? internalProgressRef.current;
      },
    }));

    return (
      <group ref={presentationRef}>
        <group ref={floatingRef}>
          <group ref={centeringRef}>
            <primitive object={clonedScene} />
          </group>
        </group>
      </group>
    );
  },
);

GLBBurgerModel.displayName = 'GLBBurgerModel';
useGLTF.preload(MODEL_PATH);
