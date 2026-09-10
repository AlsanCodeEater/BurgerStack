import React, { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { GLBBurgerModel } from './3d/GLBBurgerModel';
import { BurgerData } from '../types';

interface CartFlyBurgerProps {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  size: number;
  activeBurger: BurgerData;
  quantity: number;
  onComplete: () => void;
}

/**
 * Smooth main-burger -> cart transition.
 *
 * There is deliberately no "Superman" launch, speed trail, giant spin,
 * blur, or off-axis dive. The clone begins exactly over the visible
 * Configurator burger and follows one gentle arc into the real cart center.
 */
export const CartFlyBurger: React.FC<CartFlyBurgerProps> = ({
  startX,
  startY,
  targetX,
  targetY,
  size,
  activeBurger,
  quantity,
  onComplete,
}) => {
  const flyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fly = flyRef.current;
    if (!fly) return;

    const dx = targetX - startX;
    const dy = targetY - startY;

    // One gentle quadratic Bézier from the REAL Configurator burger center
    // directly into the REAL cart center. No Superman launch, no spin, no
    // side-button origin, no speed trail.
    const controlX = startX + dx * 0.52;
    const controlY =
      Math.min(startY, targetY) -
      Math.min(52, Math.max(26, Math.abs(dy) * 0.055));

    const flight = { p: 0 };

    gsap.set(fly, {
      left: startX,
      top: startY,
      xPercent: -50,
      yPercent: -50,
      scale: 1,
      rotation: 0,
      opacity: 1,
      transformOrigin: '50% 50%',
      willChange: 'left, top, transform, opacity',
    });

    const tween = gsap.to(flight, {
      p: 1,
      duration: 0.88,
      ease: 'power2.inOut',
      overwrite: 'auto',
      onUpdate: () => {
        const p = flight.p;
        const inv = 1 - p;

        const x =
          inv * inv * startX +
          2 * inv * p * controlX +
          p * p * targetX;

        const y =
          inv * inv * startY +
          2 * inv * p * controlY +
          p * p * targetY;

        // Stay large for most of the journey; shrink mainly near the cart.
        const scale =
          p < 0.72
            ? THREE.MathUtils.lerp(1, 0.88, p / 0.72)
            : THREE.MathUtils.lerp(0.88, 0.30, (p - 0.72) / 0.28);

        // Very small natural banking only — this is not a spin animation.
        const rotation = -7 * Math.sin(Math.PI * p);

        const opacity =
          p < 0.92
            ? 1
            : THREE.MathUtils.lerp(1, 0, (p - 0.92) / 0.08);

        gsap.set(fly, {
          left: x,
          top: y,
          scale,
          rotation,
          opacity,
        });
      },
      onComplete: () => {
        window.dispatchEvent(
          new CustomEvent('stacked:cart-impact'),
        );

        window.dispatchEvent(
          new CustomEvent('stacked:add-to-cart-complete', {
            detail: {
              burgerId: activeBurger.id,
              quantity,
            },
          }),
        );

        onComplete();
      },
    });

    return () => {
      tween.kill();
    };
  }, [
    startX,
    startY,
    targetX,
    targetY,
    activeBurger.id,
    quantity,
    onComplete,
  ]);

  return (
    <div
      ref={flyRef}
      style={{
        position: 'fixed',
        left: startX,
        top: startY,
        width: `${size}px`,
        height: `${size}px`,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 12],
          fov: 35,
        }}
        dpr={[1, 1.35]}
        gl={{
          alpha: true,
          antialias: true,
        }}
      >
        <GLBBurgerModel
          mode="configurator"
          enableIdleAnimation={false}
          scale={2.15}
        />
        <ambientLight intensity={1.0} />
        <directionalLight
          position={[4, 5, 6]}
          intensity={2}
        />
      </Canvas>
    </div>
  );
};
