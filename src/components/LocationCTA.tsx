import React from 'react';

export const LocationCTA = () => {
  return (
    <section id="locations" className="bg-charcoal text-warm-cream py-32 md:py-48 relative overflow-hidden flex flex-col items-center justify-center text-center">
      
      {/* Background Graphic */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <h1 className="text-[clamp(6rem,20vw,30rem)] font-black italic tracking-tighter leading-none select-none">STACKED</h1>
      </div>

      <div className="relative z-10 max-w-4xl px-6">
        <h2 className="text-[clamp(3.5rem,10vw,7.5rem)] font-black italic tracking-tighter mb-12 leading-none">
          HUNGRY YET?
        </h2>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <button className="w-full sm:w-auto bg-tomato-red text-warm-cream px-10 py-5 rounded-full text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-flame-orange transition-all hover:scale-105 active:scale-95 shadow-xl shadow-tomato-red/20">
            ORDER NOW
          </button>
          <button className="w-full sm:w-auto border border-warm-cream/20 text-warm-cream px-10 py-5 rounded-full text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-warm-cream hover:text-charcoal transition-all hover:scale-105 active:scale-95">
            FIND A RESTAURANT
          </button>
        </div>
      </div>
    </section>
  );
};
