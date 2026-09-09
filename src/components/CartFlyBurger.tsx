import React, { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { gsap } from 'gsap';
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

  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!flyRef.current) return;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const baseAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    const midX = startX + dx * 0.48;
    const midY = startY + dy * 0.48 - 55;

    const nearCartX = startX + dx * 0.82;
    const nearCartY = startY + dy * 0.82;

    // Initial state
    gsap.set(flyRef.current, {
      left: startX,
      top: startY,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      rotation: 0,
      transformOrigin: '50% 50%',
      filter: 'blur(0px)',
    });

    if (trailRef.current) {
      gsap.set(trailRef.current, {
        opacity: 0,
        rotation: baseAngle,
      });
    }

    const flyTl = gsap.timeline({
      onComplete: () => {
        window.dispatchEvent(new CustomEvent('stacked:cart-impact'));
        window.dispatchEvent(
          new CustomEvent('stacked:add-to-cart-complete', {
            detail: {
              burgerId: activeBurger.id,
              quantity,
            },
          })
        );
        onComplete();
      },
    });

    // LAUNCH
    flyTl.to(flyRef.current, {
      left: startX + dx * 0.15,
      top: startY + dy * 0.15,
      scaleX: 1.05,
      scaleY: 1.05,
      rotation: -12,
      duration: 0.10,
      ease: 'power2.out',
    });

    if (trailRef.current) {
      flyTl.to(trailRef.current, { opacity: 1, duration: 0.1 }, '<');
    }

    // SUPERMAN GLIDE
    flyTl.to(flyRef.current, {
      left: midX,
      top: midY,
      scaleX: 0.92,
      scaleY: 0.92,
      rotation: -22,
      duration: 0.32,
      ease: 'power1.inOut',
    });

    // ACCELERATE (with squash/stretch & blur)
    flyTl.to(flyRef.current, {
      left: nearCartX,
      top: nearCartY,
      scaleX: 0.72 * 1.08,
      scaleY: 0.72 * 0.94,
      rotation: -28,
      filter: 'blur(0.8px)',
      duration: 0.28,
      ease: 'power2.in',
    });

    // CART DIVE (restore squash/stretch & blur)
    flyTl.to(flyRef.current, {
      left: targetX,
      top: targetY,
      scaleX: 0.42,
      scaleY: 0.42,
      rotation: -18,
      filter: 'blur(0px)',
      duration: 0.12,
      ease: 'power4.in',
    });

    if (trailRef.current) {
      flyTl.to(trailRef.current, { opacity: 0, duration: 0.12 }, '<');
    }

    // IMPACT
    flyTl.to(flyRef.current, {
      scaleX: 0.2,
      scaleY: 0.2,
      opacity: 0,
      duration: 0.05,
    });

    return () => {
      flyTl.kill();
    };
  }, [startX, startY, targetX, targetY, activeBurger.id, quantity, onComplete]);

  return (
    <div
      ref={flyRef}
      style={{
        position: 'fixed',
        left: startX,
        top: startY,
        width: `${size}px`,
        height: `${size}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <div
        ref={trailRef}
        className="absolute top-1/2 right-[80%] h-[12%] w-[70%] -translate-y-1/2 rounded-full blur-[6px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,128,0,0.4))',
          transformOrigin: 'right center',
        }}
      />
      <Canvas
        camera={{
          position: [0, 0, 12],
          fov: 35,
        }}
        gl={{ alpha: true, antialias: true }}
      >
        <GLBBurgerModel
          mode="configurator"
          enableIdleAnimation={false}
          scale={2.15}
        />
        <ambientLight intensity={1.0} />
        <directionalLight position={[4, 5, 6]} intensity={2} />
      </Canvas>
    </div>
  );
};
