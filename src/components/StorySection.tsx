import React from 'react';
import { Leaf, Flame, MapPin, ChefHat } from 'lucide-react';

export const StorySection = () => {
  return (
    <section id="our-story" className="bg-charcoal text-warm-cream py-24 md:py-32 relative overflow-hidden border-t border-warm-cream/5">
      <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
        <h2 className="text-[clamp(2.5rem,8vw,6rem)] font-black italic tracking-tighter mb-8 leading-none">
          NO SHORTCUTS.<br />
          <span className="text-tomato-red">JUST GOOD BURGERS.</span>
        </h2>
        
        <p className="text-sm tracking-widest uppercase md:text-xs max-w-2xl mx-auto mb-20 text-warm-cream/60 leading-relaxed font-bold">
          We believe in doing things the hard way. That means fresh ingredients prepared daily, 
          beef smashed to order for the perfect caramelized crust, and sauces made from scratch in our kitchen.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-warm-cream/5 flex items-center justify-center mb-6 text-flame-orange border border-warm-cream/10">
              <ChefHat size={32} />
            </div>
            <h4 className="text-xs font-bold tracking-widest uppercase mb-2">FRESH DAILY</h4>
            <p className="text-[10px] uppercase tracking-widest text-warm-cream/40">Never frozen.<br/>Prepped by hand.</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-warm-cream/5 flex items-center justify-center mb-6 text-flame-orange border border-warm-cream/10">
              <Flame size={32} />
            </div>
            <h4 className="text-xs font-bold tracking-widest uppercase mb-2">FLAME GRILLED</h4>
            <p className="text-[10px] uppercase tracking-widest text-warm-cream/40">Smashed & seared<br/>for max flavor.</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-warm-cream/5 flex items-center justify-center mb-6 text-flame-orange border border-warm-cream/10">
              <MapPin size={32} />
            </div>
            <h4 className="text-xs font-bold tracking-widest uppercase mb-2">LOCAL SOURCED</h4>
            <p className="text-[10px] uppercase tracking-widest text-warm-cream/40">Produce from farms<br/>within 50 miles.</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-warm-cream/5 flex items-center justify-center mb-6 text-flame-orange border border-warm-cream/10">
              <Leaf size={32} />
            </div>
            <h4 className="text-xs font-bold tracking-widest uppercase mb-2">HOUSE SAUCES</h4>
            <p className="text-[10px] uppercase tracking-widest text-warm-cream/40">Secret recipes<br/>blended in-house.</p>
          </div>

        </div>
      </div>
    </section>
  );
};
