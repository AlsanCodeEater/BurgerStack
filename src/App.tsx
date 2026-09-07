/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import Lenis from 'lenis';
import { Navbar } from './components/Navbar';
import { HeroAndExploded } from './components/HeroAndExploded';
import { BurgerMenuSection } from './components/BurgerMenuSection';
import { ComboSection } from './components/ComboSection';
import { StorySection } from './components/StorySection';
import { LocationCTA } from './components/LocationCTA';
import { Footer } from './components/Footer';

export default function App() {
  useEffect(() => {
    // Initialize Lenis for smooth scrolling
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="bg-charcoal min-h-screen font-sans selection:bg-flame-orange selection:text-charcoal text-warm-cream">
      <Navbar />
      <HeroAndExploded />
      <BurgerMenuSection />
      <ComboSection />
      <StorySection />
      <LocationCTA />
      <Footer />
    </div>
  );
}
