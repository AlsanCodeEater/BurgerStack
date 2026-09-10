import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import {
  BURGER_STORY_PHASES,
  GLBBurgerModel,
} from './3d/GLBBurgerModel';

import {
  BurgerLayer,
} from '../data/burgerLayers';

import {
  ErrorBoundary,
} from './ErrorBoundary';

gsap.registerPlugin(
  ScrollTrigger,
);

const NAV_HEIGHT = 80;
const PIN_SCROLL_SCREENS = 3.35;

type ScreenPosition = {
  x: number;
  y: number;
  r: number;
};

function rangeProgress(
  progress: number,
  start: number,
  end: number,
) {
  if (end <= start) {
    return progress >= end ? 1 : 0;
  }

  return THREE.MathUtils.clamp(
    (progress - start) /
      (end - start),
    0,
    1,
  );
}

function getPhase(
  progress: number,
) {
  if (
    progress <
    BURGER_STORY_PHASES.HERO_END
  ) {
    return 'HERO';
  }

  if (
    progress <
    BURGER_STORY_PHASES.CENTERING_END
  ) {
    return 'CENTERING';
  }

  if (
    progress <
    BURGER_STORY_PHASES.CENTER_HOLD_END
  ) {
    return 'CENTER HOLD';
  }

  if (
    progress <
    BURGER_STORY_PHASES.EXPLOSION_END
  ) {
    return 'EXPLOSION';
  }

  if (
    progress <
    BURGER_STORY_PHASES.CROSSOVER_END
  ) {
    return 'EXPLODED HOLD';
  }

  if (
    progress <
    BURGER_STORY_PHASES.REBUILD_END
  ) {
    return 'REASSEMBLE';
  }

  if (
    progress <
    BURGER_STORY_PHASES.FINAL_SETTLE_END
  ) {
    return 'FINAL SETTLE';
  }

  return 'FINAL';
}

function getExplosionLabelProgress(
  progress: number,
  layerIndex: number,
) {
  const stagger =
    layerIndex * 0.0028;

  // Labels belong only to the exploded inspection state.
  const reveal =
    rangeProgress(
      progress,
      0.44 + stagger,
      0.54 + stagger,
    );

  // Fade all callouts before synchronized reassembly begins.
  const hide =
    1 -
    rangeProgress(
      progress,
      0.70,
      BURGER_STORY_PHASES.CROSSOVER_END,
    );

  return Math.min(
    reveal,
    hide,
  );
}

const StoryScene = ({
  progressRef,
  onPositionsUpdate,
  onResolvedLayers,
}: {
  progressRef: React.MutableRefObject<number>;
  onPositionsUpdate: (
    positions: Record<
      string,
      ScreenPosition
    >,
  ) => void;
  onResolvedLayers: (
    layers: BurgerLayer[],
  ) => void;
}) => (
  <>
    <GLBBurgerModel
      mode="story"
      progressRef={progressRef}
      enableIdleAnimation
      activeLayer={null}
      onPositionsUpdate={
        onPositionsUpdate
      }
      onResolvedLayers={
        onResolvedLayers
      }
    />

    <Environment
      preset="city"
      environmentIntensity={0.56}
    />

    <spotLight
      position={[7, 6, 6]}
      angle={0.5}
      penumbra={1}
      intensity={2.4}
      color="#ffd6b3"
    />

    <directionalLight
      position={[-5, 3, 3]}
      intensity={0.75}
      color="#e9f3ff"
    />

    <spotLight
      position={[0, 5, -7]}
      angle={0.8}
      penumbra={1}
      intensity={2.6}
      color="#ff9b38"
    />

    <ambientLight
      intensity={0.34}
      color="#ffe8d2"
    />
  </>
);

export const HeroAndExploded = () => {
  const sectionRef =
    useRef<HTMLElement>(null);

  const pinnedStageRef =
    useRef<HTMLDivElement>(null);

  const safeStageRef =
    useRef<HTMLDivElement>(null);

  const triggerRef =
    useRef<ScrollTrigger | null>(
      null,
    );

  const progressRef =
    useRef(0);

  const debugOverrideRef =
    useRef<number | null>(
      null,
    );

  const [resolvedLayers, setResolvedLayers] =
    useState<BurgerLayer[]>([]);

  const heroRef =
    useRef<HTMLDivElement>(null);

  const scrollHintRef =
    useRef<HTMLDivElement>(null);

  const dragHintRef =
    useRef<HTMLDivElement>(null);

  const containerRefs =
    useRef<
      Record<
        string,
        HTMLDivElement | null
      >
    >({});

  const textRefs =
    useRef<
      Record<
        string,
        HTMLDivElement | null
      >
    >({});

  const pathRefs =
    useRef<
      Record<
        string,
        SVGPathElement | null
      >
    >({});

  const dotRefs =
    useRef<
      Record<
        string,
        SVGCircleElement | null
      >
    >({});

  const sortedLayers =
    useMemo(
      () =>
        [...resolvedLayers].sort(
          (a, b) =>
            a.index -
            b.index,
        ),
      [resolvedLayers],
    );

  const updateOverlay =
    useCallback(
      (progress: number) => {
        /**
         * HERO COPY
         */
        if (
          heroRef.current
        ) {
          const fadeT =
            rangeProgress(
              progress,
              0,
              BURGER_STORY_PHASES.HERO_END,
            );

          heroRef.current.style.opacity =
            String(
              1 - fadeT,
            );

          heroRef.current.style.visibility =
            fadeT >= 0.999
              ? 'hidden'
              : 'visible';

          heroRef.current.style.transform =
            `translate(-50%, -50%) translateY(${-24 * fadeT}px) scale(${THREE.MathUtils.lerp(
              1,
              0.985,
              fadeT,
            )})`;
        }

        /**
         * SCROLL-TO-EXPLORE HINT
         */
        if (
          scrollHintRef.current
        ) {
          const fade =
            1 -
            rangeProgress(
              progress,
              0.025,
              0.095,
            );

          scrollHintRef.current.style.opacity =
            String(fade);

          scrollHintRef.current.style.visibility =
            fade <= 0.001
              ? 'hidden'
              : 'visible';

          scrollHintRef.current.style.transform =
            `translateX(-50%) translateY(${(1 - fade) * 8}px)`;
        }

        /**
         * EXPLOSION DRAG HINT
         */
        if (
          dragHintRef.current
        ) {
          const reveal =
            rangeProgress(
              progress,
              0.48,
              0.52,
            );

          const hide =
            1 -
            rangeProgress(
              progress,
              0.68,
              BURGER_STORY_PHASES.CROSSOVER_END,
            );

          const opacity =
            Math.min(
              reveal,
              hide,
            );

          dragHintRef.current.style.opacity =
            String(opacity);

          dragHintRef.current.style.visibility =
            opacity <= 0.001
              ? 'hidden'
              : 'visible';

          dragHintRef.current.style.transform =
            `translateX(-50%) translateY(${THREE.MathUtils.lerp(
              8,
              0,
              opacity,
            )}px)`;
        }

        /**
         * EXPLOSION-ONLY LABELS.
         *
         * After the exploded inspection, the Story releases directly into the Configurator.
         */
        sortedLayers.forEach(
          (layer) => {
            const labelProgress =
              getExplosionLabelProgress(
                progress,
                layer.index,
              );

            const dotT =
              rangeProgress(
                labelProgress,
                0,
                0.18,
              );

            const lineT =
              rangeProgress(
                labelProgress,
                0.10,
                0.60,
              );

            const titleT =
              rangeProgress(
                labelProgress,
                0.48,
                0.82,
              );

            const descriptionT =
              rangeProgress(
                labelProgress,
                0.68,
                1,
              );

            const container =
              containerRefs.current[
                layer.key
              ];

            const dot =
              dotRefs.current[
                layer.key
              ];

            const path =
              pathRefs.current[
                layer.key
              ];

            const text =
              textRefs.current[
                layer.key
              ];

            if (container) {
              container.style.visibility =
                labelProgress >
                0.001
                  ? 'visible'
                  : 'hidden';

              container.style.opacity =
                String(
                  labelProgress,
                );
            }

            if (dot) {
              dot.style.opacity =
                dotT >
                0
                  ? '1'
                  : '0';

              dot.style.transform =
                `scale(${Math.max(
                  0.01,
                  dotT,
                )})`;

              dot.style.transformOrigin =
                'center';
            }

            if (path) {
              path.style.opacity =
                lineT >
                0
                  ? '1'
                  : '0';

              path.style.strokeDashoffset =
                String(
                  100 -
                  lineT *
                    100,
                );
            }

            if (text) {
              const titleEl =
                text.children[0] as HTMLElement;

              const descriptionEl =
                text.children[1] as HTMLElement;

              if (titleEl) {
                titleEl.style.opacity =
                  String(
                    titleT,
                  );

                const slide =
                  (
                    1 -
                    titleT
                  ) *
                  (
                    layer.align ===
                    'left'
                      ? 12
                      : -12
                  );

                titleEl.style.transform =
                  `translateX(${slide}px)`;
              }

              if (
                descriptionEl
              ) {
                descriptionEl.style.opacity =
                  String(
                    descriptionT,
                  );

                descriptionEl.style.transform =
                  `translateY(${(1 - descriptionT) * 6}px)`;
              }
            }
          },
        );
      },
      [sortedLayers],
    );

  /**
   * GSAP ScrollTrigger owns the Story pin.
   */
  useEffect(() => {
    const section =
      sectionRef.current;

    const stage =
      pinnedStageRef.current;

    if (
      !section ||
      !stage
    ) {
      return;
    }

    const applyProgress = (
      rawProgress: number,
    ) => {
      const progress =
        debugOverrideRef.current ??
        THREE.MathUtils.clamp(
          rawProgress,
          0,
          1,
        );

      progressRef.current =
        progress;

      updateOverlay(
        progress,
      );
    };

    const context =
      gsap.context(
        () => {
          const trigger =
            ScrollTrigger.create(
              {
                trigger:
                  section,

                start:
                  'top top',

                end: () =>
                  `+=${Math.round(
                    window.innerHeight *
                    PIN_SCROLL_SCREENS,
                  )}`,

                pin:
                  stage,

                pinSpacing:
                  true,

                pinReparent:
                  true,

                anticipatePin:
                  1,

                invalidateOnRefresh:
                  true,

                scrub:
                  0.65,

                onUpdate:
                  (self) =>
                    applyProgress(
                      self.progress,
                    ),

                onRefresh:
                  (self) =>
                    applyProgress(
                      self.progress,
                    ),
              },
            );

          triggerRef.current =
            trigger;

          applyProgress(
            trigger.progress,
          );
        },
        section,
      );

    /**
     * Invisible DEV API only.
     * There is deliberately NO visible debug HUD.
     */
    if (
      import.meta.env.DEV
    ) {
      (
        window as any
      ).__BURGER_DEBUG__ = {
        setProgress(
          value: number,
        ) {
          const progress =
            THREE.MathUtils.clamp(
              Number(value) ||
                0,
              0,
              1,
            );

          debugOverrideRef.current =
            progress;

          progressRef.current =
            progress;

          updateOverlay(
            progress,
          );
        },

        jumpTo(
          value: number,
        ) {
          const progress =
            THREE.MathUtils.clamp(
              Number(value) ||
                0,
              0,
              1,
            );

          debugOverrideRef.current =
            null;

          const trigger =
            triggerRef.current;

          if (trigger) {
            const y =
              trigger.start +
              (
                trigger.end -
                trigger.start
              ) *
                progress;

            window.scrollTo(
              {
                top: y,
                behavior:
                  'auto',
              },
            );

            progressRef.current =
              progress;

            updateOverlay(
              progress,
            );
          }
        },

        clearProgressOverride() {
          debugOverrideRef.current =
            null;

          const progress =
            triggerRef.current
              ?.progress ??
            0;

          progressRef.current =
            progress;

          updateOverlay(
            progress,
          );
        },

        getProgress() {
          return progressRef.current;
        },

        getPhase() {
          return getPhase(
            progressRef.current,
          );
        },
      };
    }

    const refresh = () =>
      ScrollTrigger.refresh();

    const timer =
      window.setTimeout(
        refresh,
        250,
      );

    window.addEventListener(
      'resize',
      refresh,
    );

    return () => {
      window.clearTimeout(
        timer,
      );

      window.removeEventListener(
        'resize',
        refresh,
      );

      triggerRef.current =
        null;

      context.revert();

      if (
        import.meta.env.DEV
      ) {
        delete (
          window as any
        ).__BURGER_DEBUG__;
      }
    };
  }, [updateOverlay]);

  /**
   * Recalculate pin geometry after the GLB layer mapping has resolved.
   */
  useEffect(() => {
    if (
      !resolvedLayers.length
    ) {
      return;
    }

    const id =
      requestAnimationFrame(
        () =>
          ScrollTrigger.refresh(),
      );

    return () =>
      cancelAnimationFrame(
        id,
      );
  }, [
    resolvedLayers.length,
  ]);

  /**
   * Reposition label columns and connector lines from actual projected
   * ingredient positions.
   */
  const onPositionsUpdate =
    useCallback(
      (
        positions: Record<
          string,
          ScreenPosition
        >,
      ) => {
        const stage =
          safeStageRef.current;

        if (
          !stage ||
          sortedLayers.length ===
            0
        ) {
          return;
        }

        const width =
          stage.clientWidth;

        const height =
          stage.clientHeight;

        if (
          !width ||
          !height
        ) {
          return;
        }

        type Item = {
          layer: BurgerLayer;
          projectedX: number;
          projectedY: number;
          labelY: number;
          radius: number;
        };

        const left:
          Item[] = [];

        const right:
          Item[] = [];

        sortedLayers.forEach(
          (layer) => {
            const position =
              positions[
                layer.key
              ];

            if (
              !position ||
              !Number.isFinite(
                position.x,
              ) ||
              !Number.isFinite(
                position.y,
              )
            ) {
              return;
            }

            const item:
              Item = {
              layer,

              projectedX:
                position.x,

              projectedY:
                position.y,

              labelY:
                position.y,

              radius:
                position.r,
            };

            if (
              layer.align ===
              'left'
            ) {
              left.push(
                item,
              );
            } else {
              right.push(
                item,
              );
            }
          },
        );

        const safeTop =
          26;

        const safeBottom =
          height -
          30;

        const spacing =
          width <
          768
            ? 44
            : 64;

        const solve = (
          items: Item[],
        ) => {
          items.sort(
            (a, b) =>
              a.projectedY -
              b.projectedY,
          );

          let cursor =
            safeTop;

          items.forEach(
            (item) => {
              item.labelY =
                Math.max(
                  item.projectedY,
                  cursor,
                );

              cursor =
                item.labelY +
                spacing;
            },
          );

          if (
            items.length >
            0
          ) {
            const last =
              items[
                items.length -
                1
              ];

            const overflow =
              last.labelY -
              safeBottom;

            if (
              overflow >
              0
            ) {
              items.forEach(
                (item) => {
                  item.labelY -=
                    overflow;
                },
              );
            }

            cursor =
              safeTop;

            items.forEach(
              (item) => {
                item.labelY =
                  Math.max(
                    item.labelY,
                    cursor,
                  );

                cursor =
                  item.labelY +
                  spacing;
              },
            );
          }
        };

        solve(left);
        solve(right);

        const mobile =
          width <
          768;

        /**
         * Desktop label columns sit closer to the burger:
         *
         * 1800px example:
         * left labels ~210..430
         * burger center 900
         * right labels ~1370..1590
         */
        const centerX =
          width *
          0.5;

        const labelGap =
          mobile
            ? width *
              0.28
            : Math.min(
                width *
                  0.27,
                470,
              );

        const edge =
          mobile
            ? 10
            : 18;

        [
          ...left,
          ...right,
        ].forEach(
          (item) => {
            const isLeft =
              item.layer.align ===
              'left';

            const container =
              containerRefs.current[
                item.layer.key
              ];

            const path =
              pathRefs.current[
                item.layer.key
              ];

            const dot =
              dotRefs.current[
                item.layer.key
              ];

            const labelWidth =
              container
                ?.offsetWidth ??
              (
                mobile
                  ? 126
                  : 220
              );

            let labelX:
              number;

            if (mobile) {
              labelX =
                isLeft
                  ? edge
                  : width -
                    edge -
                    labelWidth;
            } else {
              labelX =
                isLeft
                  ? centerX -
                    labelGap -
                    labelWidth
                  : centerX +
                    labelGap;

              labelX =
                THREE.MathUtils.clamp(
                  labelX,
                  edge,
                  width -
                    edge -
                    labelWidth,
                );
            }

            if (container) {
              container.style.transform =
                `translate(${labelX}px, ${item.labelY}px) translateY(-50%)`;
            }

            const startX =
              item.projectedX +
              (
                isLeft
                  ? -item.radius *
                    0.70
                  : item.radius *
                    0.70
              );

            const startY =
              item.projectedY;

            const targetX =
              isLeft
                ? labelX +
                  labelWidth +
                  10
                : labelX -
                  10;

            const elbowA =
              startX +
              (
                isLeft
                  ? -24
                  : 24
              );

            const elbowB =
              targetX +
              (
                isLeft
                  ? 26
                  : -26
              );

            if (path) {
              path.setAttribute(
                'd',
                `M ${startX} ${startY} L ${elbowA} ${startY} L ${elbowB} ${item.labelY} L ${targetX} ${item.labelY}`,
              );
            }

            if (dot) {
              dot.setAttribute(
                'cx',
                String(
                  startX,
                ),
              );

              dot.setAttribute(
                'cy',
                String(
                  startY,
                ),
              );
            }
          },
        );
      },
      [sortedLayers],
    );

  return (
    <section
      ref={sectionRef}
      id="scroll-container"
      className="relative w-full bg-charcoal"
    >
      <div
        ref={pinnedStageRef}
        className="relative h-[100dvh] w-full overflow-hidden bg-charcoal"
      >
        <div
          ref={safeStageRef}
          className="absolute bottom-0 left-0 right-0 overflow-hidden"
          style={{
            top: `${NAV_HEIGHT}px`,
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <div className="h-[76%] w-[66%] max-w-[880px] rounded-full bg-gradient-to-r from-tomato-red/10 to-transparent opacity-25 blur-[120px]" />
          </div>

          {/*
            Story Canvas remains fully interactive.
            Labels/hero/hints above it all use pointer-events-none.
          */}
          <div className="absolute inset-0 z-10">
            <ErrorBoundary>
              <Canvas
                shadows
                camera={{
                  position:
                    [0, 0, 12],
                  fov:
                    35,
                }}
                dpr={[
                  1,
                  1.5,
                ]}
                gl={{
                  alpha:
                    true,
                  antialias:
                    true,
                }}
              >
                <StoryScene
                  progressRef={
                    progressRef
                  }
                  onPositionsUpdate={
                    onPositionsUpdate
                  }
                  onResolvedLayers={
                    setResolvedLayers
                  }
                />
              </Canvas>
            </ErrorBoundary>
          </div>

          {/*
            HERO COPY
          */}
          <div
            ref={heroRef}
            className="pointer-events-none absolute z-20 w-[min(92vw,900px)] text-center"
            style={{
              left:
                '50%',
              top:
                '58%',
              transform:
                'translate(-50%, -50%)',
              willChange:
                'opacity, transform',
            }}
          >
            <h1 className="mx-auto text-[clamp(3.3rem,8vw,7rem)] font-black uppercase leading-[0.8] tracking-tighter text-white">
              <span className="block drop-shadow-2xl">
                STACKED
              </span>

              <span className="block bg-gradient-to-b from-flame-orange to-[#b33c00] bg-clip-text text-transparent drop-shadow-lg">
                DIFFERENT.
              </span>
            </h1>

            <div className="mt-7">
              <p className="text-base font-bold uppercase tracking-wide text-warm-cream md:text-xl">
                FLAME GRILLED &amp; SMASHED FRESH
              </p>

              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-warm-cream/75 md:text-base">
                Every layer crafted for maximum flavor. Quality ingredients stacked to perfection.
              </p>

              <div className="mt-7 flex justify-center gap-7 text-xs font-bold tracking-widest text-flame-orange md:text-sm">
                <span>
                  EXPLORE LAYERS ↓
                </span>

                <a
                  href="#menu"
                  className="pointer-events-auto hover:text-warm-cream"
                >
                  VIEW MENU →
                </a>
              </div>
            </div>
          </div>

          {/*
            CONNECTORS
          */}
          <svg
            className="pointer-events-none absolute inset-0 z-30"
            width="100%"
            height="100%"
            style={{
              overflow:
                'visible',
            }}
          >
            {sortedLayers.map(
              (layer) => (
                <g
                  key={
                    layer.key
                  }
                >
                  <circle
                    ref={(
                      element,
                    ) => {
                      dotRefs.current[
                        layer.key
                      ] =
                        element;
                    }}
                    r={2.7}
                    className="fill-flame-orange"
                    style={{
                      opacity:
                        0,
                    }}
                  />

                  <path
                    ref={(
                      element,
                    ) => {
                      pathRefs.current[
                        layer.key
                      ] =
                        element;
                    }}
                    fill="none"
                    strokeWidth="1.7"
                    pathLength="100"
                    strokeDasharray="100"
                    strokeDashoffset="100"
                    className="stroke-flame-orange"
                    style={{
                      opacity:
                        0,
                    }}
                  />
                </g>
              ),
            )}
          </svg>

          {/*
            EXPLOSION-ONLY LABELS.
            Pointer events intentionally disabled so users can drag the 3D parts.
          */}
          <div className="pointer-events-none absolute inset-0 z-40">
            {sortedLayers.map(
              (layer) => {
                const isLeft =
                  layer.align ===
                  'left';

                return (
                  <div
                    key={
                      layer.key
                    }
                    ref={(
                      element,
                    ) => {
                      containerRefs.current[
                        layer.key
                      ] =
                        element;
                    }}
                    className={
                      `absolute left-0 top-0 w-[126px] bg-transparent p-0 md:w-[180px] lg:w-[220px] ` +
                      (
                        isLeft
                          ? 'text-right'
                          : 'text-left'
                      )
                    }
                    style={{
                      visibility:
                        'hidden',

                      opacity:
                        0,

                      willChange:
                        'transform, opacity',
                    }}
                  >
                    <div
                      ref={(
                        element,
                      ) => {
                        textRefs.current[
                          layer.key
                        ] =
                          element;
                      }}
                    >
                      <div className="mb-1 text-[11px] font-black uppercase leading-tight tracking-[0.18em] text-flame-orange md:text-[12px]">
                        {
                          layer.title
                        }
                      </div>

                      <div className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-warm-cream/75 md:text-[10px]">
                        {
                          layer.description
                        }
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>

          {/*
            SCROLL-TO-EXPLORE NAVIGATION
          */}
          <div
            ref={scrollHintRef}
            className="pointer-events-none absolute bottom-4 left-1/2 z-50 flex items-center gap-3 rounded-full border border-warm-cream/10 bg-charcoal/55 px-4 py-2 text-center backdrop-blur-md md:bottom-6"
            style={{
              transform:
                'translateX(-50%)',
            }}
          >
            <div className="text-[9px] font-black uppercase tracking-[0.26em] text-warm-cream/65 md:text-[10px]">
              SCROLL TO EXPLORE
            </div>
            <div className="animate-bounce text-sm leading-none text-flame-orange">
              ↓
            </div>
          </div>

          {/*
            Explosion inspection hint
          */}
          <div
            ref={dragHintRef}
            className="pointer-events-none absolute bottom-7 left-1/2 z-50 rounded-full border border-warm-cream/10 bg-charcoal/55 px-4 py-2 text-[9px] font-black uppercase tracking-[0.24em] text-warm-cream/70 backdrop-blur-md"
            style={{
              opacity:
                0,

              visibility:
                'hidden',

              transform:
                'translateX(-50%) translateY(8px)',
            }}
          >
            DRAG INGREDIENTS TO INSPECT
          </div>
        </div>
      </div>
    </section>
  );
};
