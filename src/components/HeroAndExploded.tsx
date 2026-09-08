import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const PIN_SCROLL_SCREENS = 6.2;

type ScreenPosition = { x: number; y: number; r: number };

function rangeProgress(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0;
  return THREE.MathUtils.clamp((progress - start) / (end - start), 0, 1);
}

function getPhase(progress: number) {
  if (progress < BURGER_STORY_PHASES.HERO_END) return 'HERO';
  if (progress < BURGER_STORY_PHASES.CENTERING_END) return 'CENTERING';
  if (progress < BURGER_STORY_PHASES.CENTER_HOLD_END) return 'CENTER HOLD';
  if (progress < BURGER_STORY_PHASES.EXPLOSION_END) return 'EXPLOSION';
  if (progress < BURGER_STORY_PHASES.CROSSOVER_END) return 'EXPLODED HOLD';
  if (progress < BURGER_STORY_PHASES.REBUILD_END) return 'REBUILD';
  if (progress < BURGER_STORY_PHASES.FINAL_SETTLE_END) return 'FINAL SETTLE';
  return 'FINAL';
}

const StoryScene = ({
  progressRef,
  activeLayer,
  onPositionsUpdate,
  onResolvedLayers,
}: {
  progressRef: React.MutableRefObject<number>;
  activeLayer: LayerName | null;
  onPositionsUpdate: (positions: Record<string, ScreenPosition>) => void;
  onResolvedLayers: (layers: BurgerLayer[]) => void;
}) => (
  <>
    <GLBBurgerModel
      mode="story"
      progressRef={progressRef}
      enableIdleAnimation
      activeLayer={activeLayer}
      onPositionsUpdate={onPositionsUpdate}
      onResolvedLayers={onResolvedLayers}
    />
    <Environment preset="city" environmentIntensity={0.56} />
    <spotLight position={[7, 6, 6]} angle={0.5} penumbra={1} intensity={2.4} color="#ffd6b3" />
    <directionalLight position={[-5, 3, 3]} intensity={0.75} color="#e9f3ff" />
    <spotLight position={[0, 5, -7]} angle={0.8} penumbra={1} intensity={2.6} color="#ff9b38" />
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

  const [resolvedLayers, setResolvedLayers] = useState<BurgerLayer[]>([]);
  const [activeLayer, setActiveLayer] = useState<LayerName | null>(null);
  const [debugProgress, setDebugProgress] = useState(0);

  const heroRef = useRef<HTMLDivElement>(null);
  const containerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const textRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const dotRefs = useRef<Record<string, SVGCircleElement | null>>({});

  const sortedLayers = useMemo(
    () => [...resolvedLayers].sort((a, b) => a.index - b.index),
    [resolvedLayers],
  );

  const updateOverlay = useCallback((progress: number) => {
    if (heroRef.current) {
      const fadeT = rangeProgress(progress, 0.055, BURGER_STORY_PHASES.CENTERING_END);
      heroRef.current.style.opacity = String(1 - fadeT);
      heroRef.current.style.visibility = fadeT >= 0.999 ? 'hidden' : 'visible';
      heroRef.current.style.transform =
        `translate(-50%, -50%) translateY(${-24 * fadeT}px) scale(${THREE.MathUtils.lerp(1, 0.985, fadeT)})`;
    }

    sortedLayers.forEach((layer, index) => {
      const timing = getStoryLayerTiming(index, sortedLayers.length);
      const lineT = rangeProgress(progress, timing.lineStart, timing.lineStart + 0.010);
      const textT = rangeProgress(progress, timing.textStart, timing.textStart + 0.012);

      const container = containerRefs.current[layer.key];
      const dot = dotRefs.current[layer.key];
      const path = pathRefs.current[layer.key];
      const text = textRefs.current[layer.key];

      if (container) container.style.visibility = lineT > 0.001 ? 'visible' : 'hidden';
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
        text.style.opacity = String(textT);
        const slide = (1 - textT) * (layer.align === 'left' ? 14 : -14);
        text.style.transform = `translateX(${slide}px)`;
      }
    });
  }, [sortedLayers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveLayer(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // IMPORTANT: use ScrollTrigger pinning rather than CSS sticky.
  // The previous build showed the progress changing while the visual stage
  // physically scrolled off-screen. This happens when an ancestor creates an
  // overflow/transform containing block that breaks position: sticky.
  useEffect(() => {
    const section = sectionRef.current;
    const stage = pinnedStageRef.current;
    if (!section || !stage) return;

    const applyProgress = (rawProgress: number) => {
      const p = debugOverrideRef.current ?? THREE.MathUtils.clamp(rawProgress, 0, 1);
      progressRef.current = p;
      updateOverlay(p);
      if (import.meta.env.DEV) setDebugProgress(p);
    };

    const ctx = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * PIN_SCROLL_SCREENS)}`,
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

    if (import.meta.env.DEV) {
      (window as any).__BURGER_DEBUG__ = {
        setProgress(value: number) {
          const p = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
          debugOverrideRef.current = p;
          progressRef.current = p;
          updateOverlay(p);
          setDebugProgress(p);
        },
        jumpTo(value: number) {
          const p = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
          debugOverrideRef.current = null;
          const trigger = triggerRef.current;
          if (trigger) {
            const y = trigger.start + (trigger.end - trigger.start) * p;
            window.scrollTo({ top: y, behavior: 'auto' });
            progressRef.current = p;
            updateOverlay(p);
            setDebugProgress(p);
          }
        },
        clearProgressOverride() {
          debugOverrideRef.current = null;
          const p = triggerRef.current?.progress ?? 0;
          progressRef.current = p;
          updateOverlay(p);
          setDebugProgress(p);
        },
        getProgress() {
          return progressRef.current;
        },
        getPhase() {
          return getPhase(progressRef.current);
        },
        getPinState() {
          const rect = pinnedStageRef.current?.getBoundingClientRect();
          return {
            progress: progressRef.current,
            phase: getPhase(progressRef.current),
            stageRect: rect ? {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            } : null,
            triggerStart: triggerRef.current?.start,
            triggerEnd: triggerRef.current?.end,
            triggerActive: triggerRef.current?.isActive,
          };
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
      ctx.revert();
      if (import.meta.env.DEV) delete (window as any).__BURGER_DEBUG__;
    };
  }, [updateOverlay]);

  // When the GLB has resolved, recalculate pin geometry after React has painted.
  useEffect(() => {
    if (!resolvedLayers.length) return;
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [resolvedLayers.length]);

  const onPositionsUpdate = useCallback((positions: Record<string, ScreenPosition>) => {
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
      const pos = positions[layer.key];
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
      const item: Item = {
        layer,
        projectedX: pos.x,
        projectedY: pos.y,
        labelY: pos.y,
        radius: pos.r,
      };
      (layer.align === 'left' ? left : right).push(item);
    });

    const safeTop = 26;
    const safeBottom = height - 28;
    const spacing = width < 768 ? 46 : 58;

    const solve = (items: Item[]) => {
      items.sort((a, b) => a.projectedY - b.projectedY);
      let cursor = safeTop;

      items.forEach((item) => {
        item.labelY = Math.max(item.projectedY, cursor);
        cursor = item.labelY + spacing;
      });

      if (items.length) {
        const overflow = items[items.length - 1].labelY - safeBottom;
        if (overflow > 0) items.forEach((item) => (item.labelY -= overflow));

        cursor = safeTop;
        items.forEach((item) => {
          item.labelY = Math.max(item.labelY, cursor);
          cursor = item.labelY + spacing;
        });
      }
    };

    solve(left);
    solve(right);

    const edge = width < 768 ? 10 : 28;

    [...left, ...right].forEach((item) => {
      const isLeft = item.layer.align === 'left';
      const container = containerRefs.current[item.layer.key];
      const path = pathRefs.current[item.layer.key];
      const dot = dotRefs.current[item.layer.key];

      const labelWidth = container?.offsetWidth ?? (width < 768 ? 120 : 220);
      const labelX = isLeft ? edge : width - edge - labelWidth;

      if (container) {
        container.style.transform = `translate(${labelX}px, ${item.labelY}px) translateY(-50%)`;
      }

      const startX = item.projectedX + (isLeft ? -item.radius * 0.74 : item.radius * 0.74);
      const startY = item.projectedY;
      const targetX = isLeft ? labelX + labelWidth + 10 : labelX - 10;
      const elbowA = startX + (isLeft ? -24 : 24);
      const elbowB = targetX + (isLeft ? 20 : -20);

      if (path) {
        path.setAttribute(
          'd',
          `M ${startX} ${startY} L ${elbowA} ${startY} L ${elbowB} ${item.labelY} L ${targetX} ${item.labelY}`,
        );
      }
      if (dot) {
        dot.setAttribute('cx', String(startX));
        dot.setAttribute('cy', String(startY));
      }
    });
  }, [sortedLayers]);

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
            <div className="h-[76%] w-[66%] max-w-[880px] rounded-full bg-gradient-to-r from-tomato-red/10 to-transparent opacity-25 blur-[120px]" />
          </div>

          <div className="absolute inset-0 z-10">
            <ErrorBoundary>
              <Canvas
                shadows
                camera={{ position: [0, 0, 11.7], fov: 35 }}
                dpr={[1, 1.5]}
                gl={{ alpha: true, antialias: true }}
              >
                <StoryScene
                  progressRef={progressRef}
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
              <span className="block drop-shadow-2xl">STACKED</span>
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
                <span>EXPLORE LAYERS ↓</span>
                <a href="#menu" className="pointer-events-auto hover:text-warm-cream">VIEW MENU →</a>
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
                  ref={(el) => { dotRefs.current[layer.key] = el; }}
                  r={2.5}
                  className="fill-flame-orange"
                  style={{ opacity: 0 }}
                />
                <path
                  ref={(el) => { pathRefs.current[layer.key] = el; }}
                  fill="none"
                  strokeWidth="1.7"
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
                  ref={(el) => { containerRefs.current[layer.key] = el; }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveLayer(isActive ? null : layer.key);
                  }}
                  className={
                    `pointer-events-auto absolute left-0 top-0 w-[120px] bg-transparent p-0 md:w-[180px] lg:w-[220px] ` +
                    (isLeft ? 'text-right' : 'text-left')
                  }
                  style={{ visibility: 'hidden', willChange: 'transform' }}
                >
                  <div
                    ref={(el) => { textRefs.current[layer.key] = el; }}
                    style={{ opacity: 0 }}
                    className="transition-transform duration-200 hover:scale-[1.03]"
                  >
                    <div className={`mb-1 text-[11px] font-black uppercase leading-tight tracking-[0.18em] md:text-[12px] ${isActive ? 'text-white' : 'text-flame-orange'}`}>
                      {layer.title}
                    </div>
                    <div className={`text-[9px] font-semibold uppercase leading-tight tracking-wide md:text-[10px] ${isActive ? 'text-white' : 'text-warm-cream/75'}`}>
                      {layer.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {import.meta.env.DEV && (
            <div className="pointer-events-none absolute bottom-3 right-3 z-[60] rounded bg-black/55 px-3 py-2 font-mono text-[10px] text-warm-cream/70">
              <div>burger story: {debugProgress.toFixed(3)}</div>
              <div>{getPhase(debugProgress)}</div>
              <div>layers: {sortedLayers.length}</div>
              <div>PIN: ScrollTrigger</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
