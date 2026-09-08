import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { Check, Flame, Minus, Plus } from 'lucide-react';
import { GLBBurgerModel } from './3d/GLBBurgerModel';
import { burgers } from '../data/burgers';
import { BurgerData } from '../types';
import { ErrorBoundary } from './ErrorBoundary';

const MenuScene = ({ activeBurger }: { activeBurger: BurgerData }) => {
  // interactionRef is ONLY click-selection rotation/scale.
  const interactionRef = useRef<THREE.Group>(null);
  // hoverRef is ONLY tiny idle motion.
  const hoverRef = useRef<THREE.Group>(null);
  const previousIndexRef = useRef(
    Math.max(0, burgers.findIndex((burger) => burger.id === activeBurger.id)),
  );

  useEffect(() => {
    const root = interactionRef.current;
    if (!root) return;

    const nextIndex = Math.max(
      0,
      burgers.findIndex((burger) => burger.id === activeBurger.id),
    );
    const previousIndex = previousIndexRef.current;

    if (nextIndex === previousIndex) return;

    const direction = nextIndex > previousIndex ? 1 : -1;

    gsap.killTweensOf(root.rotation);
    gsap.killTweensOf(root.scale);

    const timeline = gsap.timeline();
    timeline
      .to(
        root.rotation,
        {
          y: root.rotation.y + direction * 1.05,
          duration: 0.45,
          ease: 'power3.inOut',
        },
        0,
      )
      .to(
        root.scale,
        {
          x: 0.80,
          y: 0.80,
          z: 0.80,
          duration: 0.25,
          ease: 'power2.in',
        },
        0,
      )
      .to(
        root.scale,
        {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.45,
          ease: 'back.out(1.8)',
        },
        0.25,
      );

    previousIndexRef.current = nextIndex;

    return () => {
      timeline.kill();
    };
  }, [activeBurger.id]);

  useFrame((state) => {
    const hover = hoverRef.current;
    if (!hover) return;

    const elapsed = state.clock.getElapsedTime();
    hover.position.y = Math.sin(elapsed * 0.58) * 0.035;
    hover.rotation.y = Math.sin(elapsed * 0.28) * 0.025;
    hover.rotation.z = Math.cos(elapsed * 0.4) * 0.006;
  });

  return (
    <group ref={interactionRef}>
      <group ref={hoverRef}>
        <GLBBurgerModel
          enableIdleAnimation={false}
          mode="configurator"
          scale={2.15}
        />
      </group>

      <ContactShadows
        position={[0, -2.25, 0]}
        opacity={0.6}
        scale={8}
        blur={2.5}
        far={4}
        resolution={1024}
        color="#2d1306"
      />
      <Environment preset="city" environmentIntensity={0.58} />
      <spotLight
        position={[7, 6, 5]}
        angle={0.5}
        penumbra={1}
        intensity={2.3}
        color="#ffd8b8"
      />
      <directionalLight
        position={[-5, 3, 2]}
        intensity={0.75}
        color="#e6f2ff"
      />
      <spotLight
        position={[0, 4, -8]}
        angle={0.8}
        penumbra={1}
        intensity={2.6}
        color="#ffaa00"
      />
      <ambientLight intensity={0.3} color="#ffe6cc" />
    </group>
  );
};

const BurgerDetails = ({
  burger,
  quantity,
  setQuantity,
  side,
}: {
  burger: BurgerData;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  side: 'left' | 'right';
}) => {
  const detailsRef = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const element = detailsRef.current;
    if (!element) return;

    gsap.fromTo(
      element,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
    );
  }, [burger.id]);

  useEffect(() => {
    setAdded(false);
  }, [burger.id]);

  return (
    <div
      ref={detailsRef}
      className={
        `mt-5 border-t border-warm-cream/10 pt-5 ` +
        (side === 'right' ? 'text-right' : 'text-left')
      }
    >
      <div className="text-3xl font-black italic text-cheddar-yellow">
        ${burger.price.toFixed(2)}
      </div>

      <p
        className={
          `mt-3 max-w-[340px] text-xs leading-relaxed text-warm-cream/65 ` +
          (side === 'right' ? 'ml-auto' : '')
        }
      >
        {burger.description}
      </p>

      <div
        className={
          `mt-4 flex flex-wrap gap-2 ` +
          (side === 'right' ? 'justify-end' : 'justify-start')
        }
      >
        <span className="rounded-full border border-warm-cream/20 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-warm-cream/75">
          {burger.calories} KCAL
        </span>
        {burger.modelVariant.pattyCount > 1 && (
          <span className="rounded-full border border-warm-cream/20 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-warm-cream/75">
            DOUBLE BEEF
          </span>
        )}
        {burger.spiceLevel !== 'None' && (
          <span className="flex items-center rounded-full border border-tomato-red/30 bg-tomato-red/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-tomato-red">
            <Flame size={11} className="mr-1" />
            {burger.spiceLevel}
          </span>
        )}
      </div>

      <div className="mt-5">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-warm-cream/35">
          Ingredients
        </div>
        <p className="mt-2 text-[11px] font-bold uppercase leading-relaxed tracking-wide text-warm-cream/90">
          {burger.ingredients}
        </p>
      </div>

      <div
        className={
          `mt-5 flex flex-wrap items-center gap-3 ` +
          (side === 'right' ? 'justify-end' : 'justify-start')
        }
      >
        <div className="flex items-center rounded-full border border-warm-cream/20 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-warm-cream transition-colors hover:bg-warm-cream/10"
          >
            <Minus size={13} />
          </button>
          <span className="w-7 text-center text-sm font-bold text-warm-cream">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((value) => value + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-warm-cream transition-colors hover:bg-warm-cream/10"
          >
            <Plus size={13} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setAdded(true);
            window.setTimeout(() => setAdded(false), 1400);
          }}
          className={
            `flex min-w-[170px] items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-warm-cream transition-all ` +
            (added
              ? 'bg-green-600'
              : 'bg-flame-orange hover:bg-tomato-red')
          }
        >
          <Check size={14} />
          {added
            ? 'ADDED'
            : `ADD - $${(burger.price * quantity).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

const MenuOption = ({
  burger,
  active,
  side,
  onSelect,
  quantity,
  setQuantity,
}: {
  burger: BurgerData;
  active: boolean;
  side: 'left' | 'right';
  onSelect: (id: string) => void;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const isLeft = side === 'left';

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => onSelect(burger.id)}
        className={
          `group flex w-full items-center gap-4 py-2 ` +
          (isLeft ? 'justify-start text-left' : 'justify-end text-right')
        }
      >
        {!isLeft && (
          <span
            className={
              `h-px flex-1 transition-colors duration-300 ` +
              (active
                ? 'bg-flame-orange'
                : 'bg-warm-cream/10 group-hover:bg-warm-cream/30')
            }
          />
        )}

        {isLeft && (
          <span
            className={
              `h-2 w-2 shrink-0 rounded-full transition-all duration-300 ` +
              (active
                ? 'scale-100 bg-flame-orange shadow-[0_0_10px_rgba(255,85,0,0.8)]'
                : 'scale-0 bg-transparent')
            }
          />
        )}

        <span
          className={
            `whitespace-nowrap text-xl font-bold uppercase tracking-widest transition-colors duration-300 xl:text-2xl ` +
            (active
              ? 'text-flame-orange'
              : 'text-warm-cream/40 group-hover:text-warm-cream')
          }
        >
          {burger.name}
        </span>

        {isLeft && (
          <span
            className={
              `h-px flex-1 transition-colors duration-300 ` +
              (active
                ? 'bg-flame-orange'
                : 'bg-warm-cream/10 group-hover:bg-warm-cream/30')
            }
          />
        )}

        {!isLeft && (
          <span
            className={
              `h-2 w-2 shrink-0 rounded-full transition-all duration-300 ` +
              (active
                ? 'scale-100 bg-flame-orange shadow-[0_0_10px_rgba(255,85,0,0.8)]'
                : 'scale-0 bg-transparent')
            }
          />
        )}
      </button>

      {active && (
        <BurgerDetails
          burger={burger}
          quantity={quantity}
          setQuantity={setQuantity}
          side={side}
        />
      )}
    </div>
  );
};

export const BurgerMenuSection = () => {
  const [activeBurgerId, setActiveBurgerId] = useState(burgers[0].id);
  const [quantity, setQuantity] = useState(1);

  const activeBurger =
    burgers.find((burger) => burger.id === activeBurgerId) ?? burgers[0];

  const splitIndex = Math.ceil(burgers.length / 2);
  const leftBurgers = useMemo(() => burgers.slice(0, splitIndex), [splitIndex]);
  const rightBurgers = useMemo(() => burgers.slice(splitIndex), [splitIndex]);

  const handleSelect = (id: string) => {
    if (id === activeBurgerId) return;
    setActiveBurgerId(id);
    setQuantity(1);
  };

  return (
    <section
      id="menu"
      className="relative min-h-screen w-full overflow-hidden bg-charcoal py-20 text-warm-cream"
    >
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <div className="h-[700px] w-[700px] rounded-full bg-gradient-to-r from-tomato-red/5 to-transparent opacity-20 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px] px-6">
        <header className="mb-10 text-center">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.4em] text-warm-cream/35">
            Select Variation
          </div>
          <h2 className="text-[clamp(2.7rem,5vw,4.4rem)] font-black italic leading-none tracking-tighter text-warm-cream">
            THE <span className="text-flame-orange">CONFIGURATOR</span>
          </h2>
        </header>

        {/*
          Restored composition:
          left three variations | independent center burger | right three variations.
        */}
        <div className="grid min-h-[620px] grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(300px,420px)_minmax(420px,560px)_minmax(300px,420px)]">
          <div className="order-2 flex flex-col gap-3 lg:order-1">
            {leftBurgers.map((burger) => (
              <MenuOption
                key={burger.id}
                burger={burger}
                active={burger.id === activeBurgerId}
                side="left"
                onSelect={handleSelect}
                quantity={quantity}
                setQuantity={setQuantity}
              />
            ))}
          </div>

          <div className="order-1 h-[430px] w-full lg:order-2 lg:h-[600px]">
            <ErrorBoundary>
              <Canvas
                shadows
                camera={{ position: [0, 0, 12.5], fov: 35 }}
                dpr={[1, 1.5]}
                gl={{ alpha: true, antialias: true }}
              >
                <MenuScene activeBurger={activeBurger} />
              </Canvas>
            </ErrorBoundary>
          </div>

          <div className="order-3 flex flex-col gap-3">
            {rightBurgers.map((burger) => (
              <MenuOption
                key={burger.id}
                burger={burger}
                active={burger.id === activeBurgerId}
                side="right"
                onSelect={handleSelect}
                quantity={quantity}
                setQuantity={setQuantity}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
