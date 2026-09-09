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
  getStoryLayerTiming,
} from './3d/GLBBurgerModel';
import { BurgerLayer, LayerName } from '../data/burgerLayers';
import { ErrorBoundary } from './ErrorBoundary';

gsap.registerPlugin(ScrollTrigger);

const NAV_HEIGHT = 80;
const PIN_SCROLL_SCREENS = 6.6;

type ScreenPosition = {
  x: number;
  y: number;
  r: number;
};

function rangeProgress(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0;
  return THREE.MathUtils.clamp((progress - start) / (end - start), 0, 1);
}

function isDraggableFullBurger(progress: number) {
  return (
    progress < BURGER_STORY_PHASES.HERO_END ||
    (progress >= BURGER_STORY_PHASES.CENTERING_END &&
      progress < BURGER_STORY_PHASES.CENTER_HOLD_END) ||
    progress >= BURGER_STORY_PHASES.FINAL_SETTLE_END
  );
}

const StoryScene = ({
  progressRef,
  dragRotationRef,
  activeLayer,
  onPositionsUpdate,
  onResolvedLayers,
}: {
  progressRef: React.MutableRefObject<number>;
  dragRotationRef: React.MutableRefObject<number>;
  activeLayer: LayerName | null;
  onPositionsUpdate: (
    positions: Record<string, ScreenPosition>,
  ) => void;
  onResolvedLayers: (layers: BurgerLayer[]) => void;
}) => (
  <>
    <GLBBurgerModel
      mode="story"
      progressRef={progressRef}
      dragRotationRef={dragRotationRef}
      enableIdleAnimation
      activeLayer={activeLayer}
      onPositionsUpdate={onPositionsUpdate}
      onResolvedLayers={onResolvedLayers}
    />

    <Environment preset="city" environmentIntensity={0.56} />
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
    <ambientLight intensity={0.34} color="#ffe8d2" />
  </>
);

export const HeroAndExploded = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const pinnedStageRef = useRef<HTMLDivElement>(null);
  const safeStageRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<ScrollTrigger | null>(null);

  const progressRef = useRef(0);
  const debugOverrideRef = useRef<number | null>(null);
  const dragRotationRef = useRef(0);

  const [resolvedLayers, setResolvedLayers] = useState<BurgerLayer[]>([]);
  const [activeLayer, setActiveLayer] = useState<LayerName | null>(null);
  const [dragging, setDragging] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const containerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const textRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const dotRefs = useRef<Record<string, SVGCircleElement | null>>({});

  const dragStartXRef = useRef(0);
  const dragStartRotationRef = useRef(0);

  const sortedLayers = useMemo(
    () => [...resolvedLayers].sort((a, b) => a.index - b.index),
    [resolvedLayers],
  );

  const updateOverlay = useCallback(
    (progress: number) => {
      if (heroRef.current) {
        const fadeT = rangeProgress(
          progress,
          0,
          BURGER_STORY_PHASES.HERO_END,
        );

        heroRef.current.style.opacity = String(1 - fadeT);
        heroRef.current.style.visibility =
          fadeT >= 0.999 ? 'hidden' : 'visible';

        heroRef.current.style.transform =
          `translate(-50%, -50%) translateY(${-20 * fadeT}px) ` +
          `scale(${THREE.MathUtils.lerp(1, 0.985, fadeT)})`;
      }

      sortedLayers.forEach((layer, index) => {
        const timing = getStoryLayerTiming(index, sortedLayers.length);

        const lineDuration = Math.max(
          0.018,
          (timing.buildEnd - timing.buildStart) * 0.30,
        );

        const textDuration = Math.max(
          0.018,
          (timing.buildEnd - timing.buildStart) * 0.26,
        );

        const lineT = rangeProgress(
          progress,
          timing.lineStart,
          timing.lineStart + lineDuration,
        );

        const textT = rangeProgress(
          progress,
          timing.textStart,
          timing.textStart + textDuration,
        );

        const subT = rangeProgress(
          progress,
          timing.textStart + textDuration * 0.28,
          timing.textStart + textDuration * 1.28,
        );

        const container = containerRefs.current[layer.key];
        const dot = dotRefs.current[layer.key];
        const path = pathRefs.current[layer.key];
        const text = textRefs.current[layer.key];

        if (container) {
          container.style.visibility =
            lineT > 0.001 ? 'visible' : 'hidden';
        }

        if (dot) {
          dot.style.opacity = lineT > 0 ? '1' : '0';
          dot.style.transform = `scale(${Math.max(0.01, lineT)})`;
          dot.style.transformOrigin = 'center';
        }

        if (path) {
          path.style.opacity = lineT > 0 ? '1' : '0';
          path.style.strokeDashoffset = String(100 - lineT * 100);
        }

        if (text) {
          text.style.opacity = '1';

          const title = text.children[0] as HTMLElement;
          const description = text.children[1] as HTMLElement;

          if (title) {
            title.style.opacity = String(textT);
            const slide =
              (1 - textT) * (layer.align === 'left' ? 12 : -12);
            title.style.transform = `translateX(${slide}px)`;
          }

          if (description) {
            description.style.opacity = String(subT);
            description.style.transform =
              `translateY(${(1 - subT) * 6}px)`;
          }
        }
      });
    },
    [sortedLayers],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveLayer(null);
        dragRotationRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = pinnedStageRef.current;

    if (!section || !stage) return;

    const applyProgress = (rawProgress: number) => {
      const progress =
        debugOverrideRef.current ??
        THREE.MathUtils.clamp(rawProgress, 0, 1);

      progressRef.current = progress;
      updateOverlay(progress);
    };

    const context = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () =>
          `+=${Math.round(window.innerHeight * PIN_SCROLL_SCREENS)}`,
        pin: stage,
        pinSpacing: true,
        pinReparent: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        scrub: 0.65,
        onUpdate: (self) => applyProgress(self.progress),
        onRefresh: (self) => applyProgress(self.progress),
      });

      triggerRef.current = trigger;
      applyProgress(trigger.progress);
    }, section);

    // Keep the console-only QA helpers. There is intentionally NO visible
    // debug HUD in the rendered JSX.
    if (import.meta.env.DEV) {
      (window as any).__BURGER_DEBUG__ = {
        setProgress(value: number) {
          const progress = THREE.MathUtils.clamp(
            Number(value) || 0,
            0,
            1,
          );
          debugOverrideRef.current = progress;
          progressRef.current = progress;
          updateOverlay(progress);
        },

        jumpTo(value: number) {
          const progress = THREE.MathUtils.clamp(
            Number(value) || 0,
            0,
            1,
          );

          debugOverrideRef.current = null;

          const trigger = triggerRef.current;
          if (!trigger) return;

          const scrollY =
            trigger.start + (trigger.end - trigger.start) * progress;

          window.scrollTo({
            top: scrollY,
            behavior: 'auto',
          });

          progressRef.current = progress;
          updateOverlay(progress);
        },

        clearProgressOverride() {
          debugOverrideRef.current = null;
          const progress = triggerRef.current?.progress ?? 0;
          progressRef.current = progress;
          updateOverlay(progress);
        },

        resetRotation() {
          dragRotationRef.current = 0;
        },

        getProgress() {
          return progressRef.current;
        },
      };
    }

    const refresh = () => ScrollTrigger.refresh();
    const timer = window.setTimeout(refresh, 250);
    window.addEventListener('resize', refresh);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', refresh);
      triggerRef.current = null;
      context.revert();

      if (import.meta.env.DEV) {
        delete (window as any).__BURGER_DEBUG__;
      }
    };
  }, [updateOverlay]);

  useEffect(() => {
    if (!resolvedLayers.length) return;

    const frameId = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    return () => cancelAnimationFrame(frameId);
  }, [resolvedLayers.length]);

  const onPositionsUpdate = useCallback(
    (positions: Record<string, ScreenPosition>) => {
      const stage = safeStageRef.current;

      if (!stage || sortedLayers.length === 0) return;

      const width = stage.clientWidth;
      const height = stage.clientHeight;

      if (!width || !height) return;

      type Item = {
        layer: BurgerLayer;
        projectedX: number;
        projectedY: number;
        labelY: number;
        radius: number;
      };

      const left: Item[] = [];
      const right: Item[] = [];

      sortedLayers.forEach((layer) => {
        const position = positions[layer.key];

        if (
          !position ||
          !Number.isFinite(position.x) ||
          !Number.isFinite(position.y)
        ) {
          return;
        }

        const item: Item = {
          layer,
          projectedX: position.x,
          projectedY: position.y,
          labelY: position.y,
          radius: position.r,
        };

        (layer.align === 'left' ? left : right).push(item);
      });

      const safeTop = 34;
      const safeBottom = height - 34;
      const spacing = width < 768 ? 46 : 56;

      const solveCollisions = (items: Item[]) => {
        items.sort((a, b) => a.projectedY - b.projectedY);

        let cursor = safeTop;

        items.forEach((item) => {
          item.labelY = Math.max(
            THREE.MathUtils.clamp(
              item.projectedY,
              safeTop,
              safeBottom,
            ),
            cursor,
          );
          cursor = item.labelY + spacing;
        });

        if (!items.length) return;

        const overflow =
          items[items.length - 1].labelY - safeBottom;

        if (overflow > 0) {
          items.forEach((item) => {
            item.labelY -= overflow;
          });
        }

        cursor = safeTop;

        items.forEach((item) => {
          item.labelY = Math.max(item.labelY, cursor);
          cursor = item.labelY + spacing;
        });
      };

      solveCollisions(left);
      solveCollisions(right);

      let leftLabelX: number;
      let rightLabelX: number;

      if (width >= 1280) {
        // These columns intentionally sit much closer to the burger than the
        // old edge-aligned version. On a ~1800px viewport they land around
        // the user's marked inner guide columns.
        leftLabelX = width * 0.065;
        rightLabelX = width * 0.765;
      } else if (width >= 768) {
        leftLabelX = width * 0.035;
        rightLabelX = width * 0.735;
      } else {
        leftLabelX = 10;
        rightLabelX = width * 0.58;
      }

      [...left, ...right].forEach((item) => {
        const isLeft = item.layer.align === 'left';

        const container = containerRefs.current[item.layer.key];
        const path = pathRefs.current[item.layer.key];
        const dot = dotRefs.current[item.layer.key];

        const fallbackWidth = width < 768 ? 120 : 220;
        const labelWidth = container?.offsetWidth ?? fallbackWidth;

        const labelX = isLeft
          ? leftLabelX
          : Math.min(
              rightLabelX,
              width - labelWidth - 12,
            );

        if (container) {
          container.style.transform =
            `translate(${labelX}px, ${item.labelY}px) translateY(-50%)`;
        }

        const startX =
          item.projectedX +
          (isLeft
            ? -item.radius * 0.78
            : item.radius * 0.78);

        const startY = item.projectedY;

        const targetX = isLeft
          ? labelX + labelWidth + 8
          : labelX - 8;

        const elbowA = startX + (isLeft ? -22 : 22);
        const elbowB = targetX + (isLeft ? 16 : -16);

        if (path) {
          path.setAttribute(
            'd',
            `M ${startX} ${startY} ` +
              `L ${elbowA} ${startY} ` +
              `L ${elbowB} ${item.labelY} ` +
              `L ${targetX} ${item.labelY}`,
          );
        }

        if (dot) {
          dot.setAttribute('cx', String(startX));
          dot.setAttribute('cy', String(startY));
        }
      });
    },
    [sortedLayers],
  );

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      !isDraggableFullBurger(progressRef.current)
    ) {
      return;
    }

    dragStartXRef.current = event.clientX;
    dragStartRotationRef.current = dragRotationRef.current;
    setDragging(true);

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!dragging) return;

    const deltaX = event.clientX - dragStartXRef.current;

    dragRotationRef.current = THREE.MathUtils.clamp(
      dragStartRotationRef.current + deltaX * 0.008,
      -1.35,
      1.35,
    );
  };

  const stopDragging = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!dragging) return;

    setDragging(false);

    if (
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="scroll-container"
      className="relative w-full bg-charcoal"
    >
      <div
        ref={pinnedStageRef}
        className="relative h-[100dvh] w-full overflow-hidden bg-charcoal"
        onClick={() => setActiveLayer(null)}
      >
        <div
          ref={safeStageRef}
          className="absolute bottom-0 left-0 right-0 overflow-hidden"
          style={{ top: `${NAV_HEIGHT}px` }}
        >
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <div className="h-[78%] w-[70%] max-w-[980px] rounded-full bg-gradient-to-r from-tomato-red/10 to-transparent opacity-25 blur-[120px]" />
          </div>

          <div
            className="absolute inset-0 z-10"
            style={{
              cursor: dragging ? 'grabbing' : 'grab',
              touchAction: 'pan-y',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onPointerLeave={(event) => {
              if (dragging) stopDragging(event);
            }}
            onDoubleClick={() => {
              dragRotationRef.current = 0;
            }}
          >
            <ErrorBoundary>
              <Canvas
                shadows
                camera={{
                  position: [0, 0, 12.4],
                  fov: 35,
                }}
                dpr={[1, 1.5]}
                gl={{
                  alpha: true,
                  antialias: true,
                }}
              >
                <StoryScene
                  progressRef={progressRef}
                  dragRotationRef={dragRotationRef}
                  activeLayer={activeLayer}
                  onPositionsUpdate={onPositionsUpdate}
                  onResolvedLayers={setResolvedLayers}
                />
              </Canvas>
            </ErrorBoundary>
          </div>

          <div
            ref={heroRef}
            className="pointer-events-none absolute z-20 w-[min(92vw,900px)] text-center"
            style={{
              left: '50%',
              top: '72%',
              transform: 'translate(-50%, -50%)',
              willChange: 'opacity, transform',
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
                Every layer crafted for maximum flavor. Quality ingredients
                stacked to perfection.
              </p>

              <div className="mt-7 flex justify-center gap-7 text-xs font-bold tracking-widest text-flame-orange md:text-sm">
                <span>EXPLORE LAYERS ↓</span>

                <a
                  href="#menu"
                  className="pointer-events-auto hover:text-warm-cream"
                >
                  VIEW MENU →
                </a>
              </div>
            </div>
          </div>

          <svg
            className="pointer-events-none absolute inset-0 z-30"
            width="100%"
            height="100%"
            style={{ overflow: 'visible' }}
          >
            {sortedLayers.map((layer) => (
              <g key={layer.key}>
                <circle
                  ref={(element) => {
                    dotRefs.current[layer.key] = element;
                  }}
                  r={2.8}
                  className="fill-flame-orange"
                  style={{ opacity: 0 }}
                />

                <path
                  ref={(element) => {
                    pathRefs.current[layer.key] = element;
                  }}
                  fill="none"
                  strokeWidth="1.6"
                  pathLength="100"
                  strokeDasharray="100"
                  strokeDashoffset="100"
                  className="stroke-flame-orange"
                  style={{ opacity: 0 }}
                />
              </g>
            ))}
          </svg>

          <div className="pointer-events-none absolute inset-0 z-40">
            {sortedLayers.map((layer) => {
              const isLeft = layer.align === 'left';
              const isActive = activeLayer === layer.key;

              return (
                <button
                  type="button"
                  key={layer.key}
                  ref={(element) => {
                    containerRefs.current[layer.key] = element;
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveLayer(isActive ? null : layer.key);
                  }}
                  className={
                    `pointer-events-auto absolute left-0 top-0 ` +
                    `w-[120px] bg-transparent p-0 md:w-[180px] lg:w-[220px] ` +
                    (isLeft ? 'text-right' : 'text-left')
                  }
                  style={{
                    visibility: 'hidden',
                    willChange: 'transform',
                  }}
                >
                  <div
                    ref={(element) => {
                      textRefs.current[layer.key] = element;
                    }}
                    style={{ opacity: 0 }}
                    className="transition-transform duration-200 hover:scale-[1.03]"
                  >
                    <div
                      className={
                        `mb-1 text-[11px] font-black uppercase leading-tight ` +
                        `tracking-[0.18em] md:text-[12px] ` +
                        (isActive
                          ? 'text-white'
                          : 'text-flame-orange')
                      }
                    >
                      {layer.title}
                    </div>

                    <div
                      className={
                        `text-[9px] font-semibold uppercase leading-tight ` +
                        `tracking-wide md:text-[10px] ` +
                        (isActive
                          ? 'text-white'
                          : 'text-warm-cream/75')
                      }
                    >
                      {layer.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
