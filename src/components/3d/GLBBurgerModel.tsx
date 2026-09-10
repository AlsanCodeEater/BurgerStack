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

import {
  BURGER_LAYERS,
  BurgerLayer,
  LayerName,
} from '../../data/burgerLayers';

import {
  PRESENTATION,
  BREAKPOINTS,
} from '../../utils/responsiveConfig';

const MODEL_PATH = '/models/burger-final.glb';

/**
 * Single deterministic Story timeline.
 *
 * 0.00 - 0.10  Hero assembled
 * 0.10 - 0.18  Hero -> Story center
 * 0.18 - 0.24  Large assembled center hold
 * 0.24 - 0.40  Explosion
 * 0.40 - 0.43  Exploded hold / inspection
 * 0.43 - 0.88  Bottom -> top heavy rebuild
 * 0.88 - 0.94  Final settle
 * 0.94 - 1.00  Final assembled / interactive
 */
export const BURGER_STORY_PHASES = {
  HERO_END: 0.16,
  CENTERING_END: 0.28,
  CENTER_HOLD_END: 0.34,

  // Explosion grows to the full inspection composition.
  EXPLOSION_END: 0.68,

  // Short exploded hold where labels + part dragging are active.
  CROSSOVER_END: 0.76,

  // ALL ingredients magnetically reassemble together in this interval.
  REBUILD_END: 0.96,

  // Very short final assembled state, then the Story pin releases to Configurator.
  FINAL_SETTLE_END: 1.0,
  FINAL_END: 1.0,
} as const;

export type StoryLayerTiming = {
  buildStart: number;
  buildEnd: number;
  lineStart: number;
  textStart: number;
};

export function getStoryLayerTiming(
  index: number,
  total: number,
): StoryLayerTiming {
  const count = Math.max(1, total);

  const rebuildSpan =
    BURGER_STORY_PHASES.REBUILD_END -
    BURGER_STORY_PHASES.CROSSOVER_END;

  const slot = rebuildSpan / count;

  const buildStart =
    BURGER_STORY_PHASES.CROSSOVER_END +
    index * slot;

  const buildEnd = Math.min(
    buildStart + slot * 0.84,
    BURGER_STORY_PHASES.REBUILD_END,
  );

  // Kept for API compatibility. Labels are now driven by the explosion phase
  // in HeroAndExploded.tsx, not by these rebuild values.
  return {
    buildStart,
    buildEnd,
    lineStart: buildStart,
    textStart: buildStart,
  };
}

export interface GLBBurgerModelRef {
  presentationGroup: THREE.Group | null;
  setScrollProgress: (value: number) => void;
  getScrollProgress: () => number;
  resetManualRotation: () => void;
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
    positions: Record<
      string,
      { x: number; y: number; r: number }
    >,
  ) => void;
  onResolvedLayers?: (layers: BurgerLayer[]) => void;
}

type SavedTransform = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
};

type MotionTarget = {
  explosionDelta: THREE.Vector3;
  incomingDelta: THREE.Vector3;
  focusUpper: THREE.Vector3;
  focusLower: THREE.Vector3;
  focusActive: THREE.Vector3;
};

type PartRotationState = {
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
};

type DragState = {
  dragging: boolean;
  kind: 'whole' | 'part' | null;
  layerKey: LayerName | null;
  pointerId: number | null;
  lastX: number;
  lastY: number;
};

const clamp01 = (value: number) =>
  THREE.MathUtils.clamp(value, 0, 1);

function rangeProgress(
  progress: number,
  start: number,
  end: number,
) {
  if (end <= start) {
    return progress >= end ? 1 : 0;
  }

  return clamp01(
    (progress - start) /
      (end - start),
  );
}

function easeInOutCubic(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 -
        Math.pow(-2 * t + 2, 3) /
          2;
}

function getRootLocalBounds(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);

  const rootInverse =
    root.matrixWorld.clone().invert();

  const box =
    new THREE.Box3();

  const temp =
    new THREE.Vector3();

  const corners = Array.from(
    { length: 8 },
    () => new THREE.Vector3(),
  );

  root.traverse((object: any) => {
    if (!object.isMesh || !object.geometry) {
      return;
    }

    if (!object.geometry.boundingBox) {
      object.geometry.computeBoundingBox();
    }

    const bounds: THREE.Box3 | null =
      object.geometry.boundingBox;

    if (!bounds) {
      return;
    }

    corners[0].set(bounds.min.x, bounds.min.y, bounds.min.z);
    corners[1].set(bounds.min.x, bounds.min.y, bounds.max.z);
    corners[2].set(bounds.min.x, bounds.max.y, bounds.min.z);
    corners[3].set(bounds.min.x, bounds.max.y, bounds.max.z);
    corners[4].set(bounds.max.x, bounds.min.y, bounds.min.z);
    corners[5].set(bounds.max.x, bounds.min.y, bounds.max.z);
    corners[6].set(bounds.max.x, bounds.max.y, bounds.min.z);
    corners[7].set(bounds.max.x, bounds.max.y, bounds.max.z);

    corners.forEach((corner) => {
      temp
        .copy(corner)
        .applyMatrix4(object.matrixWorld)
        .applyMatrix4(rootInverse);

      box.expandByPoint(temp);
    });
  });

  if (box.isEmpty()) {
    box.setFromCenterAndSize(
      new THREE.Vector3(),
      new THREE.Vector3(4, 4, 2),
    );
  }

  return box;
}

function rootLocalDeltaToParentLocal(
  root: THREE.Object3D,
  object: THREE.Object3D,
  rootLocalDelta: THREE.Vector3,
) {
  const parent = object.parent;

  if (!parent) {
    return rootLocalDelta.clone();
  }

  root.updateWorldMatrix(true, false);
  parent.updateWorldMatrix(true, false);

  const worldA =
    root.localToWorld(
      new THREE.Vector3(0, 0, 0),
    );

  const worldB =
    root.localToWorld(
      rootLocalDelta.clone(),
    );

  const parentA =
    parent.worldToLocal(
      worldA.clone(),
    );

  const parentB =
    parent.worldToLocal(
      worldB.clone(),
    );

  return parentB.sub(parentA);
}

function getLayerWorldBoxCenter(
  object: THREE.Object3D,
) {
  const box =
    new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    return object.getWorldPosition(
      new THREE.Vector3(),
    );
  }

  return box.getCenter(
    new THREE.Vector3(),
  );
}

export const GLBBurgerModel = forwardRef<
  GLBBurgerModelRef,
  GLBBurgerModelProps
>(
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

    const clonedScene = useMemo(
      () => scene.clone(true),
      [scene],
    );

    /**
     * Transform ownership:
     *
     * PresentationRoot  -> scroll/camera presentation only
     * ManualRotationRoot -> pointer drag rotation only
     * FloatingRoot      -> subtle live/wave movement only
     * CenteringRoot     -> imported GLB center correction only
     */
    const presentationRef =
      useRef<THREE.Group>(null);

    const manualRotationRef =
      useRef<THREE.Group>(null);

    const floatingRef =
      useRef<THREE.Group>(null);

    const centeringRef =
      useRef<THREE.Group>(null);

    const internalProgressRef =
      useRef(0);

    const resolvedNodes =
      useRef(
        new Map<string, THREE.Object3D>(),
      );

    const semanticObjectToLayer =
      useRef(
        new Map<string, LayerName>(),
      );

    const resolvedOrder =
      useRef<BurgerLayer[]>([]);

    const originalTransforms =
      useRef(
        new Map<string, SavedTransform>(),
      );

    const motionTargets =
      useRef(
        new Map<string, MotionTarget>(),
      );

    const timings =
      useRef(
        new Map<string, StoryLayerTiming>(),
      );

    const focusOffsets =
      useRef(
        new Map<
          string,
          { upper: number; lower: number; active: number }
        >(),
      );

    const anchorLocalPoints =
      useRef(
        new Map<string, THREE.Vector3>(),
      );

    const anchorWorldRadii =
      useRef(
        new Map<string, number>(),
      );

    const rootLocalSize =
      useRef(
        new THREE.Vector3(4, 4, 2),
      );

    const manualTarget =
      useRef({ x: 0, y: 0 });

    const dragRef =
      useRef<DragState>({
        dragging: false,
        kind: null,
        layerKey: null,
        pointerId: null,
        lastX: 0,
        lastY: 0,
      });

    const partRotations =
      useRef(
        new Map<string, PartRotationState>(),
      );

    const tempEuler =
      useRef(new THREE.Euler());

    const tempQuaternion =
      useRef(new THREE.Quaternion());

    const { size, gl } =
      useThree();

    const width =
      Math.max(1, size.width);

    useEffect(() => {
      gl.domElement.style.touchAction =
        'pan-y';

      return () => {
        gl.domElement.style.cursor = '';
      };
    }, [gl]);

    useEffect(() => {
      resolvedNodes.current.clear();
      semanticObjectToLayer.current.clear();
      resolvedOrder.current = [];
      originalTransforms.current.clear();
      motionTargets.current.clear();
      timings.current.clear();
      focusOffsets.current.clear();
      anchorLocalPoints.current.clear();
      anchorWorldRadii.current.clear();
      partRotations.current.clear();

      clonedScene.updateWorldMatrix(
        true,
        true,
      );

      const worldBox =
        new THREE.Box3().setFromObject(
          clonedScene,
        );

      if (
        !worldBox.isEmpty() &&
        centeringRef.current
      ) {
        const worldCenter =
          worldBox.getCenter(
            new THREE.Vector3(),
          );

        const rootWorld =
          clonedScene.getWorldPosition(
            new THREE.Vector3(),
          );

        const parent =
          centeringRef.current.parent;

        if (parent) {
          const p0 =
            parent.worldToLocal(
              rootWorld.clone(),
            );

          const p1 =
            parent.worldToLocal(
              worldCenter.clone(),
            );

          centeringRef.current.position.copy(
            p0.sub(p1),
          );
        } else {
          centeringRef.current.position.set(
            -worldCenter.x,
            -worldCenter.y,
            -worldCenter.z,
          );
        }
      }

      const localBox =
        getRootLocalBounds(
          clonedScene,
        );

      rootLocalSize.current.copy(
        localBox.getSize(
          new THREE.Vector3(),
        ),
      );

      const ordered =
        [...BURGER_LAYERS].sort(
          (a, b) => a.index - b.index,
        );

      const resolved: Array<{
        layer: BurgerLayer;
        object: THREE.Object3D;
      }> = [];

      ordered.forEach((layer) => {
        const object =
          clonedScene.getObjectByName(
            layer.objectName,
          );

        if (!object) {
          console.warn(
            '[BurgerStory] unresolved',
            layer.key,
            layer.objectName,
          );
          return;
        }

        resolved.push({
          layer,
          object,
        });
      });

      resolvedOrder.current =
        resolved.map(
          ({ layer }) => layer,
        );

      const count =
        Math.max(1, resolved.length);

      const burgerWidth =
        Math.max(
          rootLocalSize.current.x,
          0.001,
        );

      const burgerHeight =
        Math.max(
          rootLocalSize.current.y,
          0.001,
        );

      const burgerDepth =
        Math.max(
          rootLocalSize.current.z,
          0.001,
        );

      resolved.forEach(
        ({ layer, object }, index) => {
          resolvedNodes.current.set(
            layer.key,
            object,
          );

          semanticObjectToLayer.current.set(
            object.uuid,
            layer.key,
          );

          originalTransforms.current.set(
            layer.key,
            {
              position:
                object.position.clone(),

              quaternion:
                object.quaternion.clone(),

              scale:
                object.scale.clone(),
            },
          );

          timings.current.set(
            layer.key,
            getStoryLayerTiming(
              index,
              count,
            ),
          );

          const directionX =
            THREE.MathUtils.clamp(
              layer.explosionDir.x,
              -1,
              1,
            );

          const directionY =
            THREE.MathUtils.clamp(
              layer.explosionDir.y,
              -1,
              1,
            );

          /**
           * Large explosion, but deliberately bounded.
           * Bigger Story scale supplies the visual dominance; these offsets
           * keep parts within the center portion of the viewport.
           */
          const rootExplosion =
            new THREE.Vector3(
              directionX *
                burgerWidth *
                0.64,

              directionY *
                burgerHeight *
                0.42,

              ((index % 3) - 1) *
                burgerDepth *
                0.10,
            );

          const rootIncoming =
            new THREE.Vector3(
              0,
              burgerHeight * 0.36,
              0,
            );

          motionTargets.current.set(
            layer.key,
            {
              explosionDelta:
                rootLocalDeltaToParentLocal(
                  clonedScene,
                  object,
                  rootExplosion,
                ),

              incomingDelta:
                rootLocalDeltaToParentLocal(
                  clonedScene,
                  object,
                  rootIncoming,
                ),

              focusUpper:
                rootLocalDeltaToParentLocal(
                  clonedScene,
                  object,
                  new THREE.Vector3(
                    0,
                    burgerHeight * 0.13,
                    0,
                  ),
                ),

              focusLower:
                rootLocalDeltaToParentLocal(
                  clonedScene,
                  object,
                  new THREE.Vector3(
                    0,
                    -burgerHeight * 0.13,
                    0,
                  ),
                ),

              focusActive:
                rootLocalDeltaToParentLocal(
                  clonedScene,
                  object,
                  new THREE.Vector3(
                    0,
                    0,
                    burgerDepth * 0.15,
                  ),
                ),
            },
          );

          focusOffsets.current.set(
            layer.key,
            {
              upper: 0,
              lower: 0,
              active: 0,
            },
          );

          partRotations.current.set(
            layer.key,
            {
              targetX: 0,
              targetY: 0,
              currentX: 0,
              currentY: 0,
            },
          );

          let worldAnchor:
            THREE.Vector3;

          if (layer.getAnchor) {
            worldAnchor =
              layer.getAnchor(object);
          } else {
            worldAnchor =
              getLayerWorldBoxCenter(
                object,
              );
          }

          const localAnchor =
            object.worldToLocal(
              worldAnchor.clone(),
            );

          anchorLocalPoints.current.set(
            layer.key,
            localAnchor,
          );

          const objectBox =
            new THREE.Box3().setFromObject(
              object,
            );

          const objectSize =
            objectBox.getSize(
              new THREE.Vector3(),
            );

          anchorWorldRadii.current.set(
            layer.key,
            Math.max(
              objectSize.x,
              objectSize.z,
              0.02,
            ) * 0.5,
          );
        },
      );

      console.info(
        '[BurgerStory] ready',
        {
          configured:
            BURGER_LAYERS.length,

          resolved:
            resolved.length,

          rootLocalSize:
            rootLocalSize.current.toArray(),
        },
      );

      onResolvedLayers?.(
        resolvedOrder.current,
      );
    }, [
      clonedScene,
      onResolvedLayers,
    ]);

    const getPresentationConfig = (
      viewportWidth: number,
    ) => {
      if (
        viewportWidth >=
        BREAKPOINTS.desktop
      ) {
        return PRESENTATION.desktop;
      }

      if (
        viewportWidth >=
        BREAKPOINTS.tablet
      ) {
        return PRESENTATION.tablet;
      }

      return PRESENTATION.mobile;
    };

    const getProgress = () =>
      mode === 'configurator'
        ? 1
        : clamp01(
            externalProgressRef?.current ??
              internalProgressRef.current,
          );

    const findSemanticLayer = (
      object: THREE.Object3D | null,
    ): LayerName | null => {
      let current:
        THREE.Object3D | null =
        object;

      while (current) {
        const key =
          semanticObjectToLayer.current.get(
            current.uuid,
          );

        if (key) {
          return key;
        }

        if (
          current ===
          clonedScene
        ) {
          break;
        }

        current =
          current.parent;
      }

      return null;
    };

    const isExplosionInteractive = (
      progress: number,
    ) =>
      mode === 'story' &&
      progress >=
        BURGER_STORY_PHASES.CENTER_HOLD_END &&
      progress <=
        BURGER_STORY_PHASES.CROSSOVER_END;

    const isWholeBurgerInteractive = (
      progress: number,
    ) => {
      if (mode === 'configurator') {
        return true;
      }

      return (
        progress <=
          BURGER_STORY_PHASES.CENTER_HOLD_END ||
        isExplosionInteractive(progress) ||
        progress >=
          BURGER_STORY_PHASES.REBUILD_END
      );
    };

    const setCursor = (
      cursor: string,
    ) => {
      gl.domElement.style.cursor =
        cursor;
    };

    const getClientPoint = (
      event: any,
    ) => ({
      x:
        event.clientX ??
        event.nativeEvent?.clientX ??
        0,

      y:
        event.clientY ??
        event.nativeEvent?.clientY ??
        0,
    });

    const startDrag = (
      event: any,
      forceWhole = false,
    ) => {
      const progress =
        getProgress();

      const point =
        getClientPoint(
          event,
        );

      const semanticLayer =
        !forceWhole &&
        isExplosionInteractive(
          progress,
        )
          ? findSemanticLayer(
              event.object ??
                null,
            )
          : null;

      if (semanticLayer) {
        dragRef.current = {
          dragging: true,
          kind: 'part',
          layerKey:
            semanticLayer,
          pointerId:
            event.pointerId ??
            null,
          lastX: point.x,
          lastY: point.y,
        };
      } else if (
        isWholeBurgerInteractive(
          progress,
        )
      ) {
        dragRef.current = {
          dragging: true,
          kind: 'whole',
          layerKey: null,
          pointerId:
            event.pointerId ??
            null,
          lastX: point.x,
          lastY: point.y,
        };
      } else {
        return;
      }

      event.stopPropagation?.();

      try {
        event.target?.setPointerCapture?.(
          event.pointerId,
        );
      } catch {
        try {
          gl.domElement.setPointerCapture(
            event.pointerId,
          );
        } catch {
          // Safe fallback.
        }
      }

      setCursor('grabbing');
    };

    const moveDrag = (
      event: any,
    ) => {
      const drag =
        dragRef.current;

      if (!drag.dragging) {
        return;
      }

      const point =
        getClientPoint(
          event,
        );

      const dx =
        point.x -
        drag.lastX;

      const dy =
        point.y -
        drag.lastY;

      drag.lastX =
        point.x;

      drag.lastY =
        point.y;

      if (
        drag.kind ===
        'part' &&
        drag.layerKey
      ) {
        const rotation =
          partRotations.current.get(
            drag.layerKey,
          );

        if (rotation) {
          rotation.targetY =
            THREE.MathUtils.clamp(
              rotation.targetY +
                dx * 0.016,
              -1.05,
              1.05,
            );

          rotation.targetX =
            THREE.MathUtils.clamp(
              rotation.targetX +
                dy * 0.008,
              -0.36,
              0.36,
            );
        }
      } else if (
        drag.kind ===
        'whole'
      ) {
        manualTarget.current.y =
          THREE.MathUtils.clamp(
            manualTarget.current.y +
              dx * 0.013,
            -0.95,
            0.95,
          );

        manualTarget.current.x =
          THREE.MathUtils.clamp(
            manualTarget.current.x +
              dy * 0.006,
            -0.24,
            0.24,
          );
      }

      event.stopPropagation?.();
    };

    const stopDrag = (
      event?: any,
    ) => {
      if (
        !dragRef.current.dragging
      ) {
        return;
      }

      dragRef.current.dragging =
        false;

      dragRef.current.kind =
        null;

      dragRef.current.layerKey =
        null;

      try {
        event?.target?.releasePointerCapture?.(
          event.pointerId,
        );
      } catch {
        // Safe fallback.
      }

      setCursor('grab');
    };

    const resetManualRotation = () => {
      manualTarget.current.x =
        0;

      manualTarget.current.y =
        0;

      partRotations.current.forEach(
        (rotation) => {
          rotation.targetX =
            0;

          rotation.targetY =
            0;
        },
      );
    };

    useFrame(
      (state, delta) => {
        const progress =
          getProgress();

        const presentation =
          getPresentationConfig(
            width,
          );

        const perspective =
          state.camera as THREE.PerspectiveCamera;

        const cameraT =
          easeInOutCubic(
            rangeProgress(
              progress,
              BURGER_STORY_PHASES.HERO_END,
              BURGER_STORY_PHASES.CENTERING_END,
            ),
          );

        const targetZ =
          mode === 'story'
            ? THREE.MathUtils.lerp(
                presentation.hero.cameraZ,
                presentation.story.cameraZ,
                cameraT,
              )
            : presentation.config.cameraZ;

        perspective.position.set(
          0,
          0,
          targetZ,
        );

        perspective.lookAt(
          0,
          0,
          0,
        );

        if (
          presentationRef.current
        ) {
          if (
            mode === 'story'
          ) {
            const heroY =
              presentation.hero.y;

            const storyY =
              presentation.story.y;

            const heroScale =
              presentation.hero.scale;

            const storyScale =
              presentation.story.scale;

            let currentY =
              heroY;

            let currentScale =
              heroScale;

            if (
              progress <=
              BURGER_STORY_PHASES.HERO_END
            ) {
              currentY =
                heroY;

              currentScale =
                heroScale;
            } else if (
              progress <=
              BURGER_STORY_PHASES.CENTERING_END
            ) {
              const t =
                easeInOutCubic(
                  rangeProgress(
                    progress,
                    BURGER_STORY_PHASES.HERO_END,
                    BURGER_STORY_PHASES.CENTERING_END,
                  ),
                );

              currentY =
                THREE.MathUtils.lerp(
                  heroY,
                  storyY,
                  t,
                );

              currentScale =
                THREE.MathUtils.lerp(
                  heroScale,
                  storyScale,
                  t,
                );
            } else {
              currentY =
                storyY;

              currentScale =
                storyScale;
            }

            presentationRef.current.position.set(
              position?.[0] ?? 0,
              currentY,
              position?.[2] ?? 0,
            );

            presentationRef.current.scale.setScalar(
              scale *
                currentScale,
            );
          } else {
            presentationRef.current.position.set(
              position?.[0] ?? 0,
              (position?.[1] ?? 0) +
                presentation.config.y,
              position?.[2] ?? 0,
            );

            presentationRef.current.scale.setScalar(
              presentation.config.scale *
                scale,
            );
          }
        }

        /**
         * Whole-composition drag stays responsive in Hero, explosion and final.
         * During the short magnetic reassembly we gently return to front view.
         */
        if (
          mode === 'story' &&
          progress > BURGER_STORY_PHASES.CROSSOVER_END &&
          progress < BURGER_STORY_PHASES.REBUILD_END
        ) {
          manualTarget.current.x = THREE.MathUtils.damp(
            manualTarget.current.x,
            0,
            10,
            delta,
          );
          manualTarget.current.y = THREE.MathUtils.damp(
            manualTarget.current.y,
            0,
            10,
            delta,
          );
        }

        if (manualRotationRef.current) {
          manualRotationRef.current.rotation.x = THREE.MathUtils.damp(
            manualRotationRef.current.rotation.x,
            manualTarget.current.x,
            16,
            delta,
          );
          manualRotationRef.current.rotation.y = THREE.MathUtils.damp(
            manualRotationRef.current.rotation.y,
            manualTarget.current.y,
            16,
            delta,
          );
        }

        /**
         * Per-ingredient rotations are inspectable only while exploded.
         * Once rebuild begins they smoothly reset.
         */
        partRotations.current.forEach(
          (rotation) => {
            if (
              mode === 'story' &&
              progress >
                BURGER_STORY_PHASES.CROSSOVER_END
            ) {
              rotation.targetX =
                THREE.MathUtils.damp(
                  rotation.targetX,
                  0,
                  11,
                  delta,
                );

              rotation.targetY =
                THREE.MathUtils.damp(
                  rotation.targetY,
                  0,
                  11,
                  delta,
                );
            }

            rotation.currentX =
              THREE.MathUtils.damp(
                rotation.currentX,
                rotation.targetX,
                11,
                delta,
              );

            rotation.currentY =
              THREE.MathUtils.damp(
                rotation.currentY,
                rotation.targetY,
                11,
                delta,
              );
          },
        );

        let visibleCount =
          0;

        resolvedOrder.current.forEach(
          (
            layer,
            index,
          ) => {
            const object =
              resolvedNodes.current.get(
                layer.key,
              );

            const original =
              originalTransforms.current.get(
                layer.key,
              );

            const motion =
              motionTargets.current.get(
                layer.key,
              );

            const timing =
              timings.current.get(
                layer.key,
              );

            if (
              !object ||
              !original ||
              !motion ||
              !timing
            ) {
              return;
            }

            object.position.copy(
              original.position,
            );

            object.quaternion.copy(
              original.quaternion,
            );

            object.scale.copy(
              original.scale,
            );

            object.visible =
              true;

            if (
              mode === 'story'
            ) {
              if (
                progress <=
                BURGER_STORY_PHASES.CENTER_HOLD_END
              ) {
                // Fully assembled Hero / centered burger.
              }

              else if (
                progress <=
                BURGER_STORY_PHASES.EXPLOSION_END
              ) {
                const explosionT =
                  easeInOutCubic(
                    rangeProgress(
                      progress,
                      BURGER_STORY_PHASES.CENTER_HOLD_END,
                      BURGER_STORY_PHASES.EXPLOSION_END,
                    ),
                  );

                object.position
                  .copy(
                    original.position,
                  )
                  .addScaledVector(
                    motion.explosionDelta,
                    explosionT,
                  );
              }

              else if (
                progress <=
                BURGER_STORY_PHASES.CROSSOVER_END
              ) {
                // Full exploded inspection hold.
                object.position
                  .copy(
                    original.position,
                  )
                  .add(
                    motion.explosionDelta,
                  );
              }

              else if (
                progress <=
                BURGER_STORY_PHASES.REBUILD_END
              ) {
                // Synchronized magnetic reassembly:
                // every ingredient returns together instead of stacking one-by-one.
                const returnT = easeInOutCubic(
                  rangeProgress(
                    progress,
                    BURGER_STORY_PHASES.CROSSOVER_END,
                    BURGER_STORY_PHASES.REBUILD_END,
                  ),
                );

                // Slight magnetic acceleration near the end makes the pieces
                // feel pulled together without introducing another "stack" section.
                const magneticT = 1 - Math.pow(1 - returnT, 2.35);

                object.visible = true;
                object.position
                  .copy(original.position)
                  .addScaledVector(
                    motion.explosionDelta,
                    1 - magneticT,
                  );

                // Tiny settle pulse at convergence; all parts still finish at
                // their exact original Blender transforms.
                const settlePulse =
                  Math.sin(returnT * Math.PI) * 0.012;

                object.scale.set(
                  original.scale.x * (1 + settlePulse),
                  original.scale.y * (1 - settlePulse * 0.55),
                  original.scale.z * (1 + settlePulse),
                );
              }

              else {
                // Final exact Blender assembly. This state is intentionally brief;
                // the pin releases immediately into the Configurator.
                object.visible = true;
                object.position.copy(original.position);
                object.quaternion.copy(original.quaternion);
                object.scale.copy(original.scale);
              }

              /**
               * Apply the user's exploded-part inspection rotation AFTER
               * story position is calculated.
               */
              const partRotation =
                partRotations.current.get(
                  layer.key,
                );

              if (
                partRotation &&
                (
                  isExplosionInteractive(
                    progress,
                  ) ||
                  Math.abs(
                    partRotation.currentX,
                  ) >
                    0.0001 ||
                  Math.abs(
                    partRotation.currentY,
                  ) >
                    0.0001
                )
              ) {
                tempEuler.current.set(
                  partRotation.currentX,
                  partRotation.currentY,
                  0,
                  'XYZ',
                );

                tempQuaternion.current.setFromEuler(
                  tempEuler.current,
                );

                object.quaternion
                  .copy(
                    original.quaternion,
                  )
                  .multiply(
                    tempQuaternion.current,
                  );
              }

              /**
               * Existing final click-focus support remains intact if a caller
               * still passes activeLayer.
               */
              const offsets =
                focusOffsets.current.get(
                  layer.key,
                );

              if (offsets) {
                let upperTarget =
                  0;

                let lowerTarget =
                  0;

                let activeTarget =
                  0;

                if (
                  activeLayer &&
                  progress >=
                    BURGER_STORY_PHASES.REBUILD_END &&
                  object.visible
                ) {
                  const activeIndex =
                    resolvedOrder.current.findIndex(
                      (candidate) =>
                        candidate.key ===
                        activeLayer,
                    );

                  if (
                    index >
                    activeIndex
                  ) {
                    upperTarget =
                      1;
                  } else if (
                    index <
                    activeIndex
                  ) {
                    lowerTarget =
                      1;
                  } else {
                    activeTarget =
                      1;
                  }
                }

                offsets.upper =
                  THREE.MathUtils.damp(
                    offsets.upper,
                    upperTarget,
                    10,
                    delta,
                  );

                offsets.lower =
                  THREE.MathUtils.damp(
                    offsets.lower,
                    lowerTarget,
                    10,
                    delta,
                  );

                offsets.active =
                  THREE.MathUtils.damp(
                    offsets.active,
                    activeTarget,
                    10,
                    delta,
                  );

                object.position.addScaledVector(
                  motion.focusUpper,
                  offsets.upper,
                );

                object.position.addScaledVector(
                  motion.focusLower,
                  offsets.lower,
                );

                object.position.addScaledVector(
                  motion.focusActive,
                  offsets.active,
                );
              }
            }

            if (
              object.visible
            ) {
              visibleCount +=
                1;
            }
          },
        );

        if (
          import.meta.env.DEV &&
          mode === 'story' &&
          resolvedOrder.current.length >
            0 &&
          visibleCount === 0
        ) {
          console.error(
            '[BurgerStory] EMPTY FRAME',
            progress,
          );
        }

        /**
         * Complete burgers always feel alive.
         *
         * Story wave is disabled while exploded/rebuilding.
         * Configurator already has an outer hover animation, but this component
         * can also supply a tiny live motion when enableIdleAnimation=true.
         */
        if (
          floatingRef.current
        ) {
          const reduceMotion =
            typeof window !== 'undefined' &&
            window.matchMedia(
              '(prefers-reduced-motion: reduce)',
            ).matches;

          const assembledStory =
            progress <=
              BURGER_STORY_PHASES.CENTER_HOLD_END ||
            progress >=
              BURGER_STORY_PHASES.REBUILD_END;

          const allowIdle =
            enableIdleAnimation &&
            !reduceMotion &&
            (
              mode === 'configurator' ||
              assembledStory
            );

          const elapsed =
            state.clock.getElapsedTime();

          floatingRef.current.position.y =
            allowIdle
              ? Math.sin(
                  elapsed * 0.78,
                ) * 0.085
              : 0;

          floatingRef.current.rotation.y =
            allowIdle
              ? Math.sin(
                  elapsed * 0.34,
                ) * 0.038
              : 0;

          floatingRef.current.rotation.z =
            allowIdle
              ? Math.cos(
                  elapsed * 0.46,
                ) * 0.013
              : 0;

          floatingRef.current.rotation.x =
            allowIdle
              ? Math.sin(
                  elapsed * 0.30,
                ) * 0.010
              : 0;

          const liveScale = allowIdle
            ? 1 + Math.sin(elapsed * 0.52) * 0.006
            : 1;
          floatingRef.current.scale.setScalar(liveScale);
        }

        /**
         * Project anchors only during the exploded inspection state.
         * Labels disappear before magnetic reassembly.
         */
        const needsExplosionAnchors =
          mode === 'story' &&
          progress >= 0.40 &&
          progress <=
            BURGER_STORY_PHASES.CROSSOVER_END + 0.005;

        if (
          onPositionsUpdate &&
          presentationRef.current &&
          needsExplosionAnchors
        ) {
          presentationRef.current.updateWorldMatrix(
            true,
            true,
          );

          const rect =
            gl.domElement.getBoundingClientRect();

          const positions: Record<
            string,
            {
              x: number;
              y: number;
              r: number;
            }
          > = {};

          resolvedOrder.current.forEach(
            (layer) => {
              const object =
                resolvedNodes.current.get(
                  layer.key,
                );

              const localAnchor =
                anchorLocalPoints.current.get(
                  layer.key,
                );

              if (
                !object ||
                !object.visible ||
                !localAnchor
              ) {
                return;
              }

              object.updateWorldMatrix(
                true,
                false,
              );

              const world =
                localAnchor
                  .clone()
                  .applyMatrix4(
                    object.matrixWorld,
                  );

              const projected =
                world
                  .clone()
                  .project(
                    state.camera,
                  );

              if (
                !Number.isFinite(
                  projected.x,
                ) ||
                !Number.isFinite(
                  projected.y,
                ) ||
                !Number.isFinite(
                  projected.z,
                ) ||
                projected.z <
                  -1 ||
                projected.z >
                  1
              ) {
                return;
              }

              const x =
                (
                  projected.x *
                    0.5 +
                  0.5
                ) *
                rect.width;

              const y =
                (
                  -projected.y *
                    0.5 +
                  0.5
                ) *
                rect.height;

              const radiusWorld =
                anchorWorldRadii.current.get(
                  layer.key,
                ) ?? 0.1;

              const rightWorld =
                world
                  .clone()
                  .add(
                    new THREE.Vector3(
                      radiusWorld,
                      0,
                      0,
                    ),
                  );

              const rightProjected =
                rightWorld.project(
                  state.camera,
                );

              const rightX =
                (
                  rightProjected.x *
                    0.5 +
                  0.5
                ) *
                rect.width;

              if (
                Number.isFinite(x) &&
                Number.isFinite(y)
              ) {
                positions[layer.key] = {
                  x,
                  y,
                  r: Math.max(
                    5,
                    Math.abs(
                      rightX - x,
                    ),
                  ),
                };
              }
            },
          );

          onPositionsUpdate(
            positions,
          );
        }
      },
    );

    useImperativeHandle(
      ref,
      () => ({
        get presentationGroup() {
          return presentationRef.current;
        },

        setScrollProgress(
          value: number,
        ) {
          internalProgressRef.current =
            clamp01(value);
        },

        getScrollProgress() {
          return (
            externalProgressRef?.current ??
            internalProgressRef.current
          );
        },

        resetManualRotation,
      }),
    );

    const commonModelEvents = {
      onPointerDown:
        (event: any) =>
          startDrag(
            event,
            false,
          ),

      onPointerMove:
        (event: any) =>
          moveDrag(event),

      onPointerUp:
        (event: any) =>
          stopDrag(event),

      onPointerCancel:
        (event: any) =>
          stopDrag(event),

      onPointerOver:
        (event: any) => {
          event.stopPropagation?.();

          if (
            !dragRef.current.dragging
          ) {
            setCursor('grab');
          }
        },

      onPointerOut:
        () => {
          if (
            !dragRef.current.dragging
          ) {
            setCursor('');
          }
        },

      onDoubleClick:
        (event: any) => {
          event.stopPropagation?.();

          const progress =
            getProgress();

          const layer =
            isExplosionInteractive(
              progress,
            )
              ? findSemanticLayer(
                  event.object ??
                    null,
                )
              : null;

          if (layer) {
            const rotation =
              partRotations.current.get(
                layer,
              );

            if (rotation) {
              rotation.targetX =
                0;

              rotation.targetY =
                0;
            }
          } else {
            resetManualRotation();
          }
        },
    };

    return (
      <>
        {/*
          Invisible background hit plane:
          - lets users drag the WHOLE exploded composition from empty space
          - sits behind the actual burger so real parts still receive ray hits
        */}
        <mesh
          position={[0, 0, -8]}
          onPointerDown={(event) =>
            startDrag(
              event,
              true,
            )
          }
          onPointerMove={
            moveDrag
          }
          onPointerUp={
            stopDrag
          }
          onPointerCancel={
            stopDrag
          }
          onPointerOver={() => {
            const progress =
              getProgress();

            if (
              isWholeBurgerInteractive(
                progress,
              ) &&
              !dragRef.current.dragging
            ) {
              setCursor(
                'grab',
              );
            }
          }}
          onPointerOut={() => {
            if (
              !dragRef.current.dragging
            ) {
              setCursor('');
            }
          }}
          onDoubleClick={(event) => {
            event.stopPropagation?.();
            resetManualRotation();
          }}
        >
          <planeGeometry args={[60, 60]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>

        <group
          ref={presentationRef}
          {...commonModelEvents}
        >
          <group ref={manualRotationRef}>
            <group ref={floatingRef}>
              <group ref={centeringRef}>
                <primitive
                  object={clonedScene}
                />
              </group>
            </group>
          </group>
        </group>
      </>
    );
  },
);

GLBBurgerModel.displayName =
  'GLBBurgerModel';

useGLTF.preload(
  MODEL_PATH,
);
