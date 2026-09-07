import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from "react";
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GLBBurgerModel, GLBBurgerModelRef } from "./3d/GLBBurgerModel";
import { BURGER_LAYERS, BurgerLayer, LayerName, STORY_PHASES, getLayerSegment } from "../data/burgerLayers";

gsap.registerPlugin(ScrollTrigger);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="text-red-500">Error loading 3D scene.</div>;
    return this.props.children;
  }
}

const Scene = ({ onReady, activeLayer, onPositionsUpdate, onResolvedLayers }: { onReady: () => void, activeLayer: LayerName | null, onPositionsUpdate: (positions: Record<string, {x: number, y: number, r: number}>) => void, onResolvedLayers: (layers: BurgerLayer[]) => void }) => {
  const burgerRef = useRef<GLBBurgerModelRef>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { viewport, mouse } = useThree();
  const scrollProgressRef = useRef(0);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    let trigger: globalThis.ScrollTrigger | null = null;
    let overrideProgress: number | null = null;
    
    trigger = ScrollTrigger.create({
      trigger: "#scroll-container",
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      onUpdate: (self) => {
        if (overrideProgress === null) {
          scrollProgressRef.current = self.progress;
        }
      },
    });
    
    scrollProgressRef.current = 0;
    setTimeout(() => {
      ScrollTrigger.refresh();
      if (trigger && trigger.progress && overrideProgress === null) {
        scrollProgressRef.current = trigger.progress;
      }
    }, 100);

    if (import.meta.env.DEV) {
      (window as any).__BURGER_DEBUG__ = {
        setProgress: (value: number) => {
          overrideProgress = value;
          scrollProgressRef.current = value;
          const st = ScrollTrigger.getAll().find(t => t.trigger?.id === 'scroll-container');
          if (st && st.animation) {
             st.animation.progress(value);
          }
          (window as any).__BURGER_DEBUG__.isInstant = true;
          setTimeout(() => { (window as any).__BURGER_DEBUG__.isInstant = false; }, 50);
        },
        getProgress: () => scrollProgressRef.current,
        releaseProgress: () => { overrideProgress = null; }
      };
    }

    return () => { 
      if (trigger) trigger.kill(); 
      if (import.meta.env.DEV) {
        delete (window as any).__BURGER_DEBUG__;
      }
    };
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      const scrollY = window.scrollY;
      const progress = scrollProgressRef.current;
      
      // PresentationRoot handles its own Y offset now.

      if (scrollY < window.innerHeight) {
        const targetX = (mouse.x * viewport.width) / 100;
        const targetYRot = (mouse.y * viewport.height) / 100;
        
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetX, 0.05);
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -targetYRot, 0.05);
      } else {
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.05);
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.05);
      }
    }

    if (burgerRef.current?.setScrollProgress) {
      burgerRef.current.setScrollProgress(scrollProgressRef.current);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <GLBBurgerModel 
        ref={burgerRef}
        enableIdleAnimation={true}
        activeLayer={activeLayer}
        onPositionsUpdate={onPositionsUpdate}
        onResolvedLayers={onResolvedLayers}
      />
      <ContactShadows position={[0, -2.5, 0]} opacity={0.7} scale={10} blur={2.5} far={4} resolution={1024} color="#2d1306" />
      <Environment preset="city" environmentIntensity={0.6} />
      <spotLight position={[8, 6, 5]} angle={0.5} penumbra={1} intensity={2.5} color="#ffd8b8" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0001} />
      <directionalLight position={[-5, 3, 2]} intensity={0.8} color="#e6f2ff" />
      <spotLight position={[0, 4, -8]} angle={0.8} penumbra={1} intensity={3.0} color="#ffaa00" />
      <ambientLight intensity={0.3} color="#ffe6cc" />
    </group>
  );
};

export const HeroAndExploded = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [resolvedLayers, setResolvedLayers] = useState<BurgerLayer[]>([]);
  
  const [activeLayer, setActiveLayer] = useState<LayerName | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveLayer(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const heroContentRef = useRef<HTMLDivElement>(null);
  const reassemblyTextRef = useRef<HTMLDivElement>(null);
  
  const textRefs = useRef<Record<LayerName, HTMLDivElement | null>>({} as any);
  const containerRefs = useRef<Record<LayerName, HTMLDivElement | null>>({} as any);
  const pathRefs = useRef<Record<LayerName, SVGPathElement | null>>({} as any);
  const dotRefs = useRef<Record<LayerName, SVGCircleElement | null>>({} as any);

  useLayoutEffect(() => {
    if (!sectionRef.current || !isReady || resolvedLayers.length === 0) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.2
        }
      });
      
      if (heroContentRef.current) {
        tl.to(heroContentRef.current, {
          opacity: 0,
          y: -100,
          duration: STORY_PHASES.EXPLOSION_START,
          ease: "power2.inOut"
        }, 0);
      }
      
      resolvedLayers.forEach(layer => {
        const { end } = getLayerSegment(layer.index);
        const labelStart = end + 0.01;
        
        if (dotRefs.current[layer.key]) {
          tl.to(dotRefs.current[layer.key], {
            opacity: 1, scale: 1, duration: 0.01, ease: "none"
          }, labelStart);
        }
        
        if (pathRefs.current[layer.key]) {
          tl.to(pathRefs.current[layer.key], {
            strokeDashoffset: 0, duration: 0.03, ease: "power2.out"
          }, labelStart + 0.01);
        }
        
        if (textRefs.current[layer.key]) {
          tl.to(textRefs.current[layer.key], {
            opacity: 1, x: 0, duration: 0.03, ease: "power2.out"
          }, labelStart + 0.03);
        }
      });

      if (reassemblyTextRef.current) {
        tl.fromTo(reassemblyTextRef.current, 
          { opacity: 0, y: 100 },
          { opacity: 1, y: 0, duration: 0.05, ease: "power2.out" },
          STORY_PHASES.SHOWCASE_END
        );
      }
    });

    return () => { ctx.revert(); };
  }, [isReady, resolvedLayers]);

  const onPositionsUpdate = useCallback((positions: Record<string, {x: number, y: number, r: number}>) => {
    if (resolvedLayers.length === 0) return;

    const leftItems: { layer: LayerName, projX: number, projY: number, labelY: number, r: number }[] = [];
    const rightItems: { layer: LayerName, projX: number, projY: number, labelY: number, r: number }[] = [];
    
    resolvedLayers.forEach(layer => {
      const pos = positions[layer.key];
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
      
      const item = { layer: layer.key, projX: pos.x, projY: pos.y, labelY: pos.y, r: pos.r };
      if (layer.align === "left") leftItems.push(item);
      else rightItems.push(item);
    });

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 768;

    const NAV_HEIGHT = 80;
    const SAFE_TOP = 24; // Canvas already starts below navbar
    const SAFE_BOTTOM = viewportHeight - NAV_HEIGHT - 32;
    const SPACING = 58;

    const solve = (items: typeof leftItems) => {
      items.sort((a, b) => a.projY - b.projY);
      let currentY = SAFE_TOP;
      
      items.forEach(item => {
        if (item.labelY < currentY) item.labelY = currentY;
        currentY = item.labelY + SPACING;
      });
      
      const overflow = currentY - SPACING - SAFE_BOTTOM;
      if (overflow > 0) {
        items.forEach(item => item.labelY -= overflow);
        currentY = SAFE_TOP;
        items.forEach(item => {
           if (item.labelY < currentY) item.labelY = currentY;
           currentY = item.labelY + SPACING;
        });
      }
    };
    
    solve(leftItems);
    solve(rightItems);

    const allItems = [...leftItems, ...rightItems];
    const padding = viewportWidth < 768 ? 10 : 30;
    const labelWidth = viewportWidth < 480 ? 100 : viewportWidth < 768 ? 140 : viewportWidth < 1024 ? 200 : 250;

    allItems.forEach(item => {
      const { layer, projX, projY, labelY, r } = item;
      const config = resolvedLayers.find(l => l.key === layer)!;
      const isLeft = config.align === "left";

      const containerEl = containerRefs.current[layer];
      const actualLabelWidth = containerEl ? containerEl.offsetWidth : (viewportWidth < 768 ? 120 : 250);
      
      const labelX = isLeft ? padding : viewportWidth - padding - actualLabelWidth;
      
      if (containerEl) {
        containerEl.style.transform = `translate(${labelX}px, ${labelY}px) translateY(-50%)`;
      }

      const pathEl = pathRefs.current[layer];
      if (pathEl) {
        const offsetRadius = r * 0.85; 
        const startX = projX + (isLeft ? -offsetRadius : offsetRadius);
        const startY = projY;

        const targetLabelX = isLeft ? labelX + actualLabelWidth + 10 : labelX - 10;
        const hopX = startX + (isLeft ? -20 : 20);
        const hopY = startY;
        const slopeX = targetLabelX + (isLeft ? 20 : -20);
        const slopeY = labelY;

        const d = `M ${startX} ${startY} L ${hopX} ${hopY} L ${slopeX} ${slopeY} L ${targetLabelX} ${labelY}`;
        pathEl.setAttribute("d", d);
      }

      const dotEl = dotRefs.current[layer];
      if (dotEl) {
        const offsetRadius = r * 0.85; 
        const startX = projX + (isLeft ? -offsetRadius : offsetRadius);
        dotEl.setAttribute("cx", String(startX));
        dotEl.setAttribute("cy", String(projY));
      }
    });
  }, [resolvedLayers]);

  return (
    <div ref={sectionRef} id="scroll-container" className="relative w-full h-[3000px] md:h-[4000px] lg:h-[5000px] z-0">
      <div 
        className="sticky top-0 w-full h-[100dvh] overflow-hidden cursor-default"
        onClick={() => setActiveLayer(null)}
      >
        
        {/* SAFE AREA FOR 3D AND OVERLAYS */}
        <div className="absolute left-0 right-0 bottom-0" style={{ top: '80px' }}>
          
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-[100%] h-[100%] max-w-[800px] max-h-[800px] bg-gradient-to-r from-tomato-red/10 to-transparent rounded-full blur-[120px] opacity-30"></div>
        </div>

        <div className="absolute inset-0 z-10">
          <ErrorBoundary>
            <Canvas shadows camera={{ position: [0, 0, 12], fov: 35 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
              <Scene 
                onReady={() => setIsReady(true)} 
                activeLayer={activeLayer} 
                onPositionsUpdate={onPositionsUpdate} 
                onResolvedLayers={setResolvedLayers}
              />
            </Canvas>
          </ErrorBoundary>
        </div>

        <div ref={heroContentRef} className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center pt-[100px] z-20">
          <div className="relative text-center">
            <h1 className="text-[clamp(3.5rem,10vw,7.5rem)] font-black uppercase tracking-tighter leading-[0.8] text-white w-[90vw] md:w-auto mx-auto max-w-[1200px]">
              <span className="block drop-shadow-2xl">STACKED</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-flame-orange to-[#b33c00] drop-shadow-lg">DIFFERENT.</span>
            </h1>
            <div className="mt-8">
              <p className="text-warm-cream text-lg md:text-xl font-bold tracking-wide uppercase">
                FLAME GRILLED & SMASHED FRESH
              </p>
              <p className="text-warm-cream/80 text-sm md:text-base mt-2 max-w-md mx-auto">
                Every layer crafted for maximum flavor. Quality ingredients stacked to perfection.
              </p>
              <div className="mt-8 flex gap-6 justify-center text-sm font-bold tracking-widest text-flame-orange">
                <span>EXPLORE LAYERS &darr;</span>
                <span>VIEW MENU &rarr;</span>
              </div>
            </div>
          </div>
        </div>

        <div ref={reassemblyTextRef} className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-center opacity-0 pointer-events-none z-20 text-warm-cream">
          <h2 className="text-3xl md:text-5xl leading-[0.9] font-black italic tracking-tighter text-center">
            THAT'S ONE BURGER.<br />
            <span className="text-flame-orange opacity-90">NOW MEET THE FAMILY.</span>
          </h2>
        </div>

        <svg className="absolute inset-0 pointer-events-none z-30" width="100%" height="100%" style={{ overflow: "visible" }}>
          {resolvedLayers.map(layer => (
            <g key={layer.key}>
              <circle
                ref={el => dotRefs.current[layer.key] = el}
                r={2}
                className="opacity-0 transition-colors duration-300 fill-flame-orange"
              />
              <path
                ref={el => pathRefs.current[layer.key] = el}
                fill="none"
                strokeWidth="1.5"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset="100"
                className="transition-colors duration-300 stroke-warm-cream/30"
              />
            </g>
          ))}
        </svg>

        <div className="absolute inset-0 pointer-events-none z-40">
          {resolvedLayers.map(layer => {
            const isLeft = layer.align === "left";
            const isActive = activeLayer === layer.key;
            
            return (
              <div 
                key={layer.key}
                ref={el => containerRefs.current[layer.key] = el}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveLayer(isActive ? null : layer.key);
                }}
                className={`absolute top-0 left-0 w-[100px] min-[480px]:w-[120px] md:w-[160px] lg:w-[200px] xl:w-[250px] pointer-events-auto group flex flex-col justify-center cursor-pointer ${isLeft ? "items-end text-right" : "items-start text-left"}`}
                style={{ willChange: "transform" }}
              >
                <div 
                  ref={el => textRefs.current[layer.key] = el} 
                  className={`opacity-0 transition-all duration-300 ${isLeft ? "origin-right" : "origin-left"} group-hover:scale-105 ${isActive ? "scale-110" : ""}`}
                  style={{ transform: `translateX(${isLeft ? "16px" : "-16px"})` }}
                >
                  <div className={`text-[10px] md:text-[12px] uppercase tracking-[0.18em] mb-1 font-bold leading-tight transition-colors duration-300 ${isActive ? "text-white" : "text-flame-orange"} group-hover:text-white`}>
                    {layer.title}
                  </div>
                  <div className={`text-[9px] md:text-[10px] uppercase font-semibold tracking-wide leading-tight transition-opacity duration-300 ${isActive ? "opacity-100 text-white" : "opacity-75 text-warm-cream"}`}>
                    {layer.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>

      </div>
    </div>
  );
};
