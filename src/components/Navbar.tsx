import React, { useState, useEffect } from 'react';
import { ShoppingCart, Menu, X } from 'lucide-react';

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-charcoal/90 backdrop-blur-md py-4 shadow-lg' : 'bg-transparent py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex-1">
          <a href="#" className="text-2xl font-bold tracking-tighter text-warm-cream">
            STACKED<span className="text-flame-orange">.</span>
          </a>
        </div>

        {/* Center: Links (Desktop) */}
        <nav className="hidden md:flex flex-1 justify-center space-x-8">
          {['MENU', 'OUR STORY', 'LOCATIONS'].map((item) => (
            <a 
              key={item} 
              href={`#${item.toLowerCase().replace(' ', '-')}`}
              className={`text-sm font-semibold tracking-widest transition-colors hover:text-flame-orange ${
                scrolled ? 'text-warm-cream/80' : 'text-warm-cream'
              }`}
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="flex-1 flex justify-end items-center space-x-6">
          <button className="hover:text-flame-orange transition-colors text-warm-cream">
            <ShoppingCart size={24} />
          </button>
          <button className="hidden md:inline-block bg-flame-orange text-warm-cream px-6 py-3 rounded-full font-bold tracking-wide hover:bg-tomato-red transition-colors relative z-50">
            ORDER NOW
          </button>
          <button 
            className="md:hidden hover:text-flame-orange text-warm-cream relative z-50"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Full Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-charcoal/95 backdrop-blur-xl flex flex-col items-center justify-center pt-20 px-6 h-[100dvh]"
             onClick={() => setMobileMenuOpen(false)}>
          <nav className="flex flex-col space-y-8 items-center w-full max-w-md" onClick={e => e.stopPropagation()}>
            {['MENU', 'OUR STORY', 'LOCATIONS'].map((item) => (
              <a 
                key={item} 
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="text-3xl font-black italic tracking-widest text-warm-cream hover:text-flame-orange transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <button className="bg-flame-orange text-warm-cream px-8 py-5 rounded-full font-bold tracking-widest hover:bg-tomato-red transition-colors w-full max-w-xs mt-8 shadow-lg shadow-flame-orange/20"
                    onClick={() => setMobileMenuOpen(false)}>
              ORDER NOW
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};
