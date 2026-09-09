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
 * One deterministic story timeline.
 *
 * 0.00 - 0.10  Hero assembled
 * 0.10 - 0.18  Hero -> center transition
 * 0.18 - 0.24  Center hold
 * 0.24 - 0.40  Explosion
 * 0.40 - 0.43  Exploded hold
 * 0.43 - 0.88  Bottom -> top rebuild
 * 0.88 - 0.94  Final settle
 * 0.94 - 1.00  Final assembled hold
 */
export const BURGER_STORY_PHASES = {
  HERO_END: 0.10,
  CENTERING_END: 0.18,
  CENTER_HOLD_END: 0.24,
  EXPLOSION_END: 0.40,
  CROSSOVER_END: 0.43,
  REBUILD_END: 0.88,
  FINAL_SETTLE_END: 0.94,
  FINAL_END: 1,
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

  // Keep each layer mostly inside its own slot so the rebuild is readable.
  const buildEnd = Math.min(
    buildStart + slot * 0.84,
    BURGER_STORY_PHASES.REBUILD_END,
  );

  return {
    buildStart,
    buildEnd,
    lineStart: buildStart + slot * 0.58,
    textStart: buildStart + slot * 0.68,
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
    positions: Record<
      string,
      {
        x: number;
        y: number;
        r: number;
      }
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

/**
 * Get bounds in the imported GLB root's LOCAL space.
 *
 * Generated GLBs often contain nested scales such as 0.01 / 100.
 * Using root-local measurements keeps all motion predictable.
 */
function getRootLocalBounds(
  root: THREE.Object3D,
) {
  root.updateWorldMatrix(
    true,
    true,
  );

  const rootInverse =
    root.matrixWorld
      .clone()
      .invert();

  const box =
    new THREE.Box3();

  const temp =
    new THREE.Vector3();

  const corners =
    Array.from(
      { length: 8 },
      () => new THREE.Vector3(),
    );

  root.traverse(
    (object: any) => {
      if (
        !object.isMesh ||
        !object.geometry
      ) {
        return;
      }

      if (
        !object.geometry.boundingBox
      ) {
        object.geometry.computeBoundingBox();
      }

      const bounds:
        | THREE.Box3
        | null =
        object.geometry.boundingBox;

      if (!bounds) {
        return;
      }

      corners[0].set(
        bounds.min.x,
        bounds.min.y,
        bounds.min.z,
      );

      corners[1].set(
        bounds.min.x,
        bounds.min.y,
        bounds.max.z,
      );

      corners[2].set(
        bounds.min.x,
        bounds.max.y,
        bounds.min.z,
      );

      corners[3].set(
        bounds.min.x,
        bounds.max.y,
        bounds.max.z,
      );

      corners[4].set(
        bounds.max.x,
        bounds.min.y,
        bounds.min.z,
      );

      corners[5].set(
        bounds.max.x,
        bounds.min.y,
        bounds.max.z,
      );

      corners[6].set(
        bounds.max.x,
        bounds.max.y,
        bounds.min.z,
      );

      corners[7].set(
        bounds.max.x,
        bounds.max.y,
        bounds.max.z,
      );

      corners.forEach(
        (corner) => {
          temp
            .copy(corner)
            .applyMatrix4(
              object.matrixWorld,
            )
            .applyMatrix4(
              rootInverse,
            );

          box.expandByPoint(
            temp,
          );
        },
      );
    },
  );

  if (box.isEmpty()) {
    box.setFromCenterAndSize(
      new THREE.Vector3(),
      new THREE.Vector3(
        4,
        4,
        2,
      ),
    );
  }

  return box;
}

/**
 * Convert a delta from GLB-root-local space into the target object's
 * parent-local space.
 *
 * This prevents Blender parent scale values from making explosion/rebuild
 * offsets visually tiny or enormous.
 */
function rootLocalDeltaToParentLocal(
  root: THREE.Object3D,
  object: THREE.Object3D,
  rootLocalDelta: THREE.Vector3,
) {
  const parent =
    object.parent;

  if (!parent) {
    return rootLocalDelta.clone();
  }

  root.updateWorldMatrix(
    true,
    false,
  );

  parent.updateWorldMatrix(
    true,
    false,
  );

  const worldA =
    root.localToWorld(
      new THREE.Vector3(
        0,
        0,
        0,
      ),
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

  return parentB.sub(
    parentA,
  );
}

function getLayerWorldBoxCenter(
  object: THREE.Object3D,
) {
  const box =
    new THREE.Box3().setFromObject(
      object,
    );

  if (box.isEmpty()) {
    return object.getWorldPosition(
      new THREE.Vector3(),
    );
  }

  return box.getCenter(
    new THREE.Vector3(),
  );
}

export const GLBBurgerModel =
  forwardRef<
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
        progressRef:
          externalProgressRef,
        onPositionsUpdate,
        onResolvedLayers,
      },
      ref,
    ) => {
      const { scene } =
        useGLTF(url);

      // Story and Configurator must never mutate the same Object3D instance.
      const clonedScene =
        useMemo(
          () =>
            scene.clone(true),
          [scene],
        );

      const presentationRef =
        useRef<THREE.Group>(
          null,
        );

      const floatingRef =
        useRef<THREE.Group>(
          null,
        );

      const centeringRef =
        useRef<THREE.Group>(
          null,
        );

      const internalProgressRef =
        useRef(0);

      const resolvedNodes =
        useRef(
          new Map<
            string,
            THREE.Object3D
          >(),
        );

      const resolvedOrder =
        useRef<
          BurgerLayer[]
        >([]);

      const originalTransforms =
        useRef(
          new Map<
            string,
            SavedTransform
          >(),
        );

      const motionTargets =
        useRef(
          new Map<
            string,
            MotionTarget
          >(),
        );

      const timings =
        useRef(
          new Map<
            string,
            StoryLayerTiming
          >(),
        );

      const focusOffsets =
        useRef(
          new Map<
            string,
            {
              upper: number;
              lower: number;
              active: number;
            }
          >(),
        );

      const anchorLocalPoints =
        useRef(
          new Map<
            string,
            THREE.Vector3
          >(),
        );

      const anchorWorldRadii =
        useRef(
          new Map<
            string,
            number
          >(),
        );

      const rootLocalSize =
        useRef(
          new THREE.Vector3(
            4,
            4,
            2,
          ),
        );

      const { size, gl } =
        useThree();

      const width =
        Math.max(
          1,
          size.width,
        );

      useEffect(() => {
        resolvedNodes.current.clear();
        resolvedOrder.current = [];
        originalTransforms.current.clear();
        motionTargets.current.clear();
        timings.current.clear();
        focusOffsets.current.clear();
        anchorLocalPoints.current.clear();
        anchorWorldRadii.current.clear();

        clonedScene.updateWorldMatrix(
          true,
          true,
        );

        /**
         * Center the imported GLB once.
         * This wrapper is NOT an animation channel.
         */
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
            (a, b) =>
              a.index -
              b.index,
          );

        const resolved:
          Array<{
            layer: BurgerLayer;
            object: THREE.Object3D;
          }> = [];

        ordered.forEach(
          (layer) => {
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
          },
        );

        resolvedOrder.current =
          resolved.map(
            ({ layer }) =>
              layer,
          );

        const count =
          Math.max(
            1,
            resolved.length,
          );

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
          (
            { layer, object },
            index,
          ) => {
            resolvedNodes.current.set(
              layer.key,
              object,
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

            /**
             * Use each semantic layer's intended direction from burgerLayers.ts.
             * Scale from actual burger bounds so the explosion reads clearly.
             */
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

            const rootExplosion =
              new THREE.Vector3(
                directionX *
                  burgerWidth *
                  0.76,

                directionY *
                  burgerHeight *
                  0.44,

                ((index % 3) -
                  1) *
                  burgerDepth *
                  0.10,
              );

            /**
             * Rebuild entrance is LOCAL to each ingredient.
             * It does not start at the navbar or top of the viewport.
             */
            const rootIncoming =
              new THREE.Vector3(
                0,
                burgerHeight *
                  0.34,
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
                      burgerHeight *
                        0.13,
                      0,
                    ),
                  ),

                focusLower:
                  rootLocalDeltaToParentLocal(
                    clonedScene,
                    object,
                    new THREE.Vector3(
                      0,
                      -burgerHeight *
                        0.13,
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
                      burgerDepth *
                        0.15,
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

            /**
             * Use custom anchor when supplied (e.g. BunBottom),
             * otherwise use the visible world bounding-box center.
             */
            let worldAnchor:
              THREE.Vector3;

            if (
              layer.getAnchor
            ) {
              worldAnchor =
                layer.getAnchor(
                  object,
                );
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

            timings:
              resolved.map(
                (
                  { layer },
                  index,
                ) => ({
                  key:
                    layer.key,

                  ...getStoryLayerTiming(
                    index,
                    resolved.length,
                  ),
                }),
              ),
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

      useFrame((state) => {
        const progress =
          mode ===
          'configurator'
            ? 1
            : clamp01(
                externalProgressRef?.current ??
                  internalProgressRef.current,
              );

        const presentation =
          getPresentationConfig(
            width,
          );

        const perspective =
          state.camera as THREE.PerspectiveCamera;

        /**
         * Camera only transitions during Hero -> Story centering.
         */
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

        /**
         * PresentationRoot:
         * - Hero has its own position/scale.
         * - It transitions once into Story.
         * - Once centered, it remains locked throughout explosion/rebuild/final.
         */
        if (
          presentationRef.current
        ) {
          if (
            mode === 'story'
          ) {
            const HERO_Y =
              presentation.hero.y;

            const STORY_Y =
              presentation.story.y;

            const HERO_SCALE =
              presentation.hero.scale;

            const STORY_SCALE =
              presentation.story.scale;

            let currentY =
              HERO_Y;

            let currentScale =
              HERO_SCALE;

            if (
              progress <=
              BURGER_STORY_PHASES.HERO_END
            ) {
              currentY =
                HERO_Y;

              currentScale =
                HERO_SCALE;
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
                  HERO_Y,
                  STORY_Y,
                  t,
                );

              currentScale =
                THREE.MathUtils.lerp(
                  HERO_SCALE,
                  STORY_SCALE,
                  t,
                );
            } else {
              currentY =
                STORY_Y;

              currentScale =
                STORY_SCALE;
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

        let visibleCount = 0;

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

            /**
             * PURE / deterministic:
             * restore the exact Blender transform every frame.
             */
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
              /**
               * HERO + CENTERING + CENTER HOLD
               * Always show the complete assembled burger.
               */
              if (
                progress <=
                BURGER_STORY_PHASES.CENTER_HOLD_END
              ) {
                object.visible =
                  true;
              }

              /**
               * EXPLOSION
               */
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

              /**
               * MAX EXPLOSION HOLD
               */
              else if (
                progress <=
                BURGER_STORY_PHASES.CROSSOVER_END
              ) {
                object.position
                  .copy(
                    original.position,
                  )
                  .add(
                    motion.explosionDelta,
                  );
              }

              /**
               * REBUILD + FINAL
               */
              else {
                if (
                  progress <
                  timing.buildStart
                ) {
                  object.visible =
                    false;
                }

                else if (
                  progress <=
                  timing.buildEnd
                ) {
                  const buildT =
                    rangeProgress(
                      progress,
                      timing.buildStart,
                      timing.buildEnd,
                    );

                  /**
                   * Different ingredients feel differently weighted.
                   */
                  let impactStrength =
                    0.55;

                  const name =
                    layer.objectName.toLowerCase();

                  if (
                    name.includes(
                      'bun',
                    ) ||
                    name.includes(
                      'brioche',
                    )
                  ) {
                    impactStrength =
                      1.0;
                  }

                  if (
                    name.includes(
                      'beef',
                    ) ||
                    name.includes(
                      'patty',
                    ) ||
                    name.includes(
                      'smash',
                    )
                  ) {
                    impactStrength =
                      1.15;
                  }

                  if (
                    name.includes(
                      'cheese',
                    ) ||
                    name.includes(
                      'jack',
                    ) ||
                    name.includes(
                      'cheddar',
                    )
                  ) {
                    impactStrength =
                      0.75;
                  }

                  /**
                   * A) HEAVY DROP
                   */
                  if (
                    buildT <
                    0.72
                  ) {
                    const t =
                      buildT /
                      0.72;

                    // Fast acceleration into the stack.
                    const gravity =
                      1 -
                      Math.pow(
                        1 - t,
                        4,
                      );

                    object.position
                      .copy(
                        original.position,
                      )
                      .addScaledVector(
                        motion.incomingDelta,
                        1 - gravity,
                      );
                  }

                  /**
                   * B) IMPACT / SQUASH
                   */
                  else if (
                    buildT <
                    0.84
                  ) {
                    const impactT =
                      (buildT -
                        0.72) /
                      0.12;

                    const squash =
                      Math.sin(
                        impactT *
                          Math.PI,
                      ) *
                      impactStrength;

                    object.position.copy(
                      original.position,
                    );

                    object.scale.set(
                      original.scale.x *
                        (
                          1 +
                          0.035 *
                            squash
                        ),

                      original.scale.y *
                        (
                          1 -
                          0.045 *
                            squash
                        ),

                      original.scale.z *
                        (
                          1 +
                          0.035 *
                            squash
                        ),
                    );
                  }

                  /**
                   * C) SMALL REBOUND / SETTLE
                   */
                  else {
                    const settleT =
                      (buildT -
                        0.84) /
                      0.16;

                    const bounce =
                      Math.sin(
                        settleT *
                          Math.PI *
                          2,
                      ) *
                      (1 -
                        settleT) *
                      impactStrength;

                    object.position.copy(
                      original.position,
                    );

                    object.position.addScaledVector(
                      motion.incomingDelta,
                      bounce *
                        0.045,
                    );

                    object.scale.copy(
                      original.scale,
                    );
                  }
                }

                /**
                 * Finished layer:
                 * lock exactly to original Blender transform.
                 */
                else {
                  object.visible =
                    true;

                  object.position.copy(
                    original.position,
                  );

                  object.quaternion.copy(
                    original.quaternion,
                  );

                  object.scale.copy(
                    original.scale,
                  );
                }
              }

              /**
               * Click focus after final assembly.
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
                      (
                        candidate,
                      ) =>
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
                  THREE.MathUtils.lerp(
                    offsets.upper,
                    upperTarget,
                    0.10,
                  );

                offsets.lower =
                  THREE.MathUtils.lerp(
                    offsets.lower,
                    lowerTarget,
                    0.10,
                  );

                offsets.active =
                  THREE.MathUtils.lerp(
                    offsets.active,
                    activeTarget,
                    0.10,
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

        /**
         * Development safety:
         * the Story should never have zero visible layers.
         */
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
         * Click-focus yaw only.
         * Story transforms do not accumulate here.
         */
        if (
          presentationRef.current
        ) {
          const focusLayer =
            resolvedOrder.current.find(
              (layer) =>
                layer.key ===
                activeLayer,
            );

          const targetRotationY =
            mode === 'story' &&
            activeLayer &&
            progress >=
              BURGER_STORY_PHASES.REBUILD_END
              ? focusLayer?.align ===
                'left'
                ? -0.2007
                : 0.2007
              : 0;

          presentationRef.current.rotation.y =
            THREE.MathUtils.lerp(
              presentationRef.current.rotation.y,
              targetRotationY,
              0.09,
            );
        }

        /**
         * Wave / idle motion:
         * - Hero assembled burger
         * - Final assembled Story burger
         * - Configurator burger
         *
         * Disabled during explosion/rebuild so it cannot fight story motion.
         */
        if (
          floatingRef.current
        ) {
          const reduceMotion =
            typeof window !==
              'undefined' &&
            window.matchMedia(
              '(prefers-reduced-motion: reduce)',
            ).matches;

          const fullBurgerPhase =
            mode ===
              'configurator' ||
            progress <=
              BURGER_STORY_PHASES.HERO_END ||
            progress >=
              BURGER_STORY_PHASES.FINAL_SETTLE_END;

          const allowIdle =
            enableIdleAnimation &&
            !reduceMotion &&
            fullBurgerPhase;

          const elapsed =
            state.clock.getElapsedTime();

          floatingRef.current.position.y =
            allowIdle
              ? Math.sin(
                  elapsed *
                    0.72,
                ) *
                0.055
              : 0;

          floatingRef.current.rotation.z =
            allowIdle
              ? Math.cos(
                  elapsed *
                    0.43,
                ) *
                0.007
              : 0;

          floatingRef.current.rotation.x =
            allowIdle
              ? Math.sin(
                  elapsed *
                    0.31,
                ) *
                0.004
              : 0;
        }

        /**
         * Project visible layer anchors to the Story Canvas.
         * Hero does not need label anchors.
         */
        if (
          onPositionsUpdate &&
          presentationRef.current &&
          (
            mode ===
              'configurator' ||
            progress >=
              BURGER_STORY_PHASES.CROSSOVER_END -
                0.01
          )
        ) {
          presentationRef.current.updateWorldMatrix(
            true,
            true,
          );

          const rect =
            gl.domElement.getBoundingClientRect();

          const positions:
            Record<
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
                projected.z < -1 ||
                projected.z > 1
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

              /**
               * Approximate a screen radius for connector start offset.
               */
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
                Number.isFinite(
                  x,
                ) &&
                Number.isFinite(
                  y,
                )
              ) {
                positions[layer.key] = {
                  x,
                  y,
                  r: Math.max(
                    5,
                    Math.abs(
                      rightX -
                        x,
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
      });

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
        }),
      );

      return (
        <group
          ref={presentationRef}
        >
          <group
            ref={floatingRef}
          >
            <group
              ref={centeringRef}
            >
              <primitive
                object={
                  clonedScene
                }
              />
            </group>
          </group>
        </group>
      );
    },
  );

GLBBurgerModel.displayName =
  'GLBBurgerModel';

useGLTF.preload(
  MODEL_PATH,
);
