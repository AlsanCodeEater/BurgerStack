import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { gsap } from 'gsap';
import { GLBBurgerModel, GLBBurgerModelRef } from './3d/GLBBurgerModel';
import { burgers } from '../data/burgers';
import { BurgerData } from '../types';
import { Plus, Minus, Flame, Check } from 'lucide-react';
import * as THREE from 'three';
import { ErrorBoundary } from './ErrorBoundary';

const MenuScene = ({ 
  activeBurger, 
  hoverAngle 
}: { 
  activeBurger: BurgerData, 
  hoverAngle: number | null 
}) => {
  const burgerRef = useRef<GLBBurgerModelRef>(null);
  const groupRef = useRef<THREE.Group>(null);
  const prevBurgerId = useRef(activeBurger.id);

  // Animate on variation change
  useEffect(() => {
    if (groupRef.current && prevBurgerId.current !== activeBurger.id) {
      // A quick celebratory spin/bounce when changing the active burger
      gsap.fromTo(groupRef.current.scale, 
        { x: 0.8, y: 1.2, z: 0.8 }, 
        { x: 1, y: 1, z: 1, duration: 0.8, ease: "elastic.out(1, 0.3)" }
      );
      gsap.fromTo(groupRef.current.rotation,
        { y: groupRef.current.rotation.y - Math.PI },
        { y: groupRef.current.rotation.y, duration: 0.8, ease: "power2.out" }
      );
      prevBurgerId.current = activeBurger.id;
    }
  }, [activeBurger.id]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    
    // Base hover
    let targetRotY = Math.sin(t * 0.5) * 0.05;
    
    // Turn towards hovered item
    if (hoverAngle !== null) {
      targetRotY = hoverAngle;
    }
    
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);
  });

  return (
    <group ref={groupRef} position={[0, -0.35, 0]}>
      <GLBBurgerModel 
        ref={burgerRef}
        enableIdleAnimation={false}
        mode="configurator"
      />
      <ContactShadows position={[0, -1.8, 0]} opacity={0.7} scale={10} blur={2.5} far={4} resolution={1024} color="#2d1306" />
      <Environment preset="city" environmentIntensity={0.6} />
      <spotLight 
        position={[8, 6, 5]} 
        angle={0.5} 
        penumbra={1} 
        intensity={2.5} 
        color="#ffd8b8" 
        castShadow 
        shadow-mapSize-width={2048} 
        shadow-mapSize-height={2048} 
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-5, 3, 2]} intensity={0.8} color="#e6f2ff" />
      <spotLight 
        position={[0, 4, -8]} 
        angle={0.8} 
        penumbra={1} 
        intensity={3.0} 
        color="#ffaa00" 
      />
      <ambientLight intensity={0.3} color="#ffe6cc" />
    </group>
  );
};

export const BurgerMenuSection = () => {
  const [activeBurgerId, setActiveBurgerId] = useState<string>(burgers[0].id);
  const [hoveredBurgerId, setHoveredBurgerId] = useState<string | null>(null);

  const activeBurger = burgers.find(b => b.id === activeBurgerId) || burgers[0];

  // Calculate angles for 6 items (3 left, 3 right)
  const leftItems = burgers.slice(0, 3);
  const rightItems = burgers.slice(3, 6);

  const handleBurgerSelect = (id: string) => {
    setActiveBurgerId(id);
  };

  // Calculate rotation angle towards the hovered or active item
  const getHoverAngle = () => {
    const targetId = hoveredBurgerId || activeBurgerId;
    const isLeft = leftItems.find(b => b.id === targetId);
    return isLeft ? -Math.PI / 8 : Math.PI / 8;
  };

  return (
    <section id="menu" className="relative w-full min-h-screen bg-charcoal overflow-hidden py-12 md:py-24 flex flex-col justify-center">
      
      {/* Background ambient lighting */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="w-[800px] h-[800px] bg-gradient-to-r from-tomato-red/5 to-transparent rounded-full blur-[120px] opacity-20"></div>
      </div>

      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <ErrorBoundary>
          <Canvas 
            shadows 
            camera={{ position: [0, 0, 16], fov: 35 }}
            dpr={[1, 1.5]}
          >
            <MenuScene activeBurger={activeBurger} hoverAngle={getHoverAngle()} />
          </Canvas>
        </ErrorBoundary>
      </div>

      {/* Header */}
      <div className="relative z-10 w-full text-center mb-8 pointer-events-none h-[120px] flex flex-col justify-center">
        <h2 className="text-[clamp(0.75rem,2vw,0.875rem)] font-bold tracking-[0.4em] uppercase text-warm-cream/40 mb-4">Select Variation</h2>
        <div className="text-[clamp(2.5rem,5vw,3.5rem)] font-black italic tracking-tighter text-warm-cream">THE <span className="text-flame-orange">CONFIGURATOR</span></div>
      </div>

      {/* HTML Menu Overlay */}
      <div className="relative z-10 w-full flex-1 max-w-[1500px] mx-auto px-4 md:px-8 flex flex-col md:grid md:grid-cols-2 lg:grid-cols-[minmax(300px,1fr)_minmax(460px,620px)_minmax(300px,1fr)] gap-6 lg:items-center pointer-events-none">
        
        {/* Mobile/Tablet Spacer for 3D Burger */}
        <div className="lg:hidden w-full md:col-span-2 h-[35vh] min-h-[300px] pointer-events-none"></div>

        {/* Left Column (or Mobile Top) */}
        <div className="flex flex-col w-full space-y-4 md:space-y-6">
          {leftItems.map((burger) => (
            <MenuItem 
              key={burger.id} 
              burger={burger} 
              align="left"
              isSelected={activeBurgerId === burger.id}
              onHover={() => setHoveredBurgerId(burger.id)}
              onLeave={() => setHoveredBurgerId(null)}
              onClick={() => handleBurgerSelect(burger.id)}
            />
          ))}
        </div>

        {/* Center spacing for burger (Desktop) */}
        <div className="hidden lg:block w-full h-full pointer-events-none"></div>

        {/* Right Column (or Mobile Bottom) */}
        <div className="flex flex-col w-full space-y-4 md:space-y-6 md:mt-0 lg:items-end">
          {rightItems.map((burger) => (
            <MenuItem 
              key={burger.id} 
              burger={burger} 
              align="right"
              isSelected={activeBurgerId === burger.id}
              onHover={() => setHoveredBurgerId(burger.id)}
              onLeave={() => setHoveredBurgerId(null)}
              onClick={() => handleBurgerSelect(burger.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const MenuItem = ({ 
  burger, 
  align, 
  isSelected,
  onHover, 
  onLeave, 
  onClick 
}: { 
  burger: BurgerData, 
  align: 'left' | 'right',
  isSelected: boolean,
  onHover: () => void,
  onLeave: () => void,
  onClick: () => void,
}) => {
  const [quantity, setQuantity] = useState(1);

  // Reset quantity when deselected
  useEffect(() => {
    if (!isSelected) {
      setQuantity(1);
    }
  }, [isSelected]);

  return (
    <div 
      className={`group pointer-events-auto cursor-pointer w-full transition-all duration-500 flex flex-col ${align === 'right' ? 'md:items-end md:text-right items-start text-left' : 'items-start text-left'}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={() => {
        if (!isSelected) onClick();
      }}
    >
      {/* Title & Connector Line Area */}
      <div className={`flex items-center gap-4 w-full ${align === 'right' ? 'md:flex-row-reverse flex-row' : 'flex-row'} ${isSelected ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
        <div className={`hidden md:block flex-1 transition-all duration-500 h-[1px] ${isSelected ? 'bg-flame-orange' : 'bg-warm-cream/20 group-hover:bg-warm-cream/40'}`}></div>
        <h4 className={`text-xl md:text-2xl font-bold tracking-widest uppercase transition-colors ${isSelected ? 'text-flame-orange' : 'text-warm-cream'}`}>
          {burger.name}
        </h4>
        {isSelected && (
          <div className="w-2 h-2 rounded-full bg-flame-orange shadow-[0_0_10px_rgba(255,85,0,0.8)]"></div>
        )}
      </div>

      {/* Expandable Details Container */}
      <div 
        className={`grid transition-all duration-500 ease-in-out w-full max-w-sm`}
        style={{ gridTemplateRows: isSelected ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className={`pt-6 pb-2 ${align === 'right' ? 'md:pl-6 pr-6 md:pr-0' : 'pr-6'}`}>
            
            <div className={`flex items-center gap-4 mb-4 ${align === 'right' ? 'md:justify-end justify-start' : 'justify-start'}`}>
              <span className="font-black italic text-cheddar-yellow text-3xl">${burger.price.toFixed(2)}</span>
            </div>

            <p className="text-warm-cream/60 text-xs leading-relaxed mb-6">
              {burger.description}
            </p>
            
            <div className={`flex flex-wrap gap-2 mb-6 ${align === 'right' ? 'md:justify-end justify-start' : 'justify-start'}`}>
              <span className="px-3 py-1 border border-warm-cream/20 rounded-full text-[9px] font-bold tracking-widest text-warm-cream/80 uppercase">
                {burger.calories} KCAL
              </span>
              {burger.modelVariant.pattyCount > 1 && (
                <span className="px-3 py-1 border border-warm-cream/20 rounded-full text-[9px] font-bold tracking-widest text-warm-cream/80 uppercase">
                  DOUBLE BEEF
                </span>
              )}
              {burger.spiceLevel !== 'None' && (
                <span className="px-3 py-1 border border-tomato-red/30 bg-tomato-red/10 rounded-full text-[9px] font-bold tracking-widest text-tomato-red uppercase flex items-center">
                  <Flame size={10} className="mr-1" /> {burger.spiceLevel}
                </span>
              )}
            </div>

            <div className="mb-6">
              <div className="text-[9px] uppercase tracking-[0.2em] text-warm-cream/40 font-bold mb-2">Ingredients</div>
              <p className="text-warm-cream text-xs font-bold uppercase tracking-wider">{burger.ingredients}</p>
            </div>

            <div className={`flex items-center gap-4 mt-8 flex-wrap ${align === 'right' ? 'md:flex-row-reverse flex-row' : 'flex-row'}`}>
              {/* Quantity Selector */}
              <div 
                className="flex items-center space-x-3 border border-warm-cream/20 rounded-full px-2 py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-warm-cream/10 transition-colors text-warm-cream"
                >
                  <Minus size={12} />
                </button>
                <span className="font-bold text-xs w-3 text-center text-warm-cream">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-warm-cream/10 transition-colors text-warm-cream"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Add to Order CTA */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  console.log(`Added ${quantity} ${burger.name} to order!`);
                  const btn = e.currentTarget;
                  const originalText = btn.innerHTML;
                  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ADDED TO ORDER`;
                  btn.classList.add('bg-green-600', 'shadow-[0_0_20px_rgba(22,163,74,0.3)]');
                  btn.classList.remove('bg-flame-orange', 'shadow-[0_0_20px_rgba(255,85,0,0.3)]');
                  setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('bg-green-600', 'shadow-[0_0_20px_rgba(22,163,74,0.3)]');
                    btn.classList.add('bg-flame-orange', 'shadow-[0_0_20px_rgba(255,85,0,0.3)]');
                  }, 2000);
                }}
                className="flex-1 bg-flame-orange text-warm-cream py-3 rounded-full text-xs font-bold tracking-widest uppercase hover:bg-tomato-red transition-colors flex justify-center gap-2 items-center shadow-[0_0_20px_rgba(255,85,0,0.3)] hover:shadow-[0_0_30px_rgba(255,85,0,0.5)]"
              >
                <Check size={14} /> ADD TO ORDER - ${(burger.price * quantity).toFixed(2)}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
