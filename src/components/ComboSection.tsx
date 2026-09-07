import React from 'react';

export const ComboSection = () => {
  return (
    <section className="bg-charcoal text-warm-cream py-24 md:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <h2 className="text-[clamp(2.5rem,8vw,6.25rem)] leading-[0.8] font-black italic tracking-tighter mb-16 md:mb-24 text-center">
          PERFECT<br />
          <span className="text-flame-orange">COMBINATIONS.</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8 items-center">
          {/* Asymmetric layout - Text Left */}
          <div className="md:col-span-5 space-y-6 order-2 md:order-1 flex flex-col justify-center">
            <h3 className="text-4xl md:text-6xl font-black italic tracking-tighter leading-none">THE<br/>STANDARD</h3>
            <p className="text-warm-cream/60 text-sm max-w-md leading-relaxed">
              Any classic stack burger, golden crinkle-cut fries, and a house-made craft soda. The way it was meant to be.
            </p>
            <div className="text-2xl font-black italic text-cheddar-yellow">$14.50</div>
            <button className="border border-warm-cream/20 px-8 py-4 rounded-full text-xs font-bold tracking-widest uppercase hover:bg-warm-cream hover:text-charcoal transition-colors mt-4 self-start">
              ADD COMBO
            </button>
          </div>
          
          {/* Visual Right */}
          <div className="md:col-span-7 relative h-96 md:h-[600px] bg-white/5 rounded-[2rem] overflow-hidden group order-1 md:order-2 flex items-center justify-center">
             {/* Abstract composition representing a combo */}
             <div className="absolute inset-0 bg-gradient-to-tr from-charcoal to-white/5"></div>
             
             {/* Typography Graphic */}
             <div className="absolute inset-0 flex items-center justify-center mix-blend-overlay opacity-30 group-hover:scale-105 transition-transform duration-1000">
               <h1 className="text-[10rem] md:text-[14rem] font-black italic tracking-tighter text-warm-cream leading-none -rotate-6">FRIES</h1>
             </div>

             <div className="relative z-10 text-center space-y-4">
                <div className="w-24 h-24 rounded-full border border-flame-orange/30 flex items-center justify-center mx-auto mb-4 bg-charcoal/50 backdrop-blur-md text-flame-orange">
                  <span className="text-4xl font-black">+</span>
                </div>
                <p className="text-xs font-bold tracking-widest uppercase text-warm-cream/80">Golden Crispy Fries</p>
             </div>
             
             <div className="absolute bottom-8 right-8 text-warm-cream/30 text-[10px] font-bold tracking-widest uppercase rotate-90 origin-bottom-right">
               * Drink Included
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8 items-center mt-24">
          
          {/* Visual Left */}
          <div className="md:col-span-7 relative h-96 md:h-[600px] bg-flame-orange rounded-[2rem] overflow-hidden group flex items-center justify-center">
             <div className="absolute inset-0 bg-gradient-to-bl from-transparent to-black/20"></div>
             
             {/* Typography Graphic */}
             <div className="absolute inset-0 flex items-center justify-center mix-blend-overlay opacity-40 group-hover:scale-105 transition-transform duration-1000">
               <h1 className="text-[10rem] md:text-[14rem] font-black italic tracking-tighter text-charcoal leading-none rotate-6">SHAKE</h1>
             </div>

             <div className="relative z-10 text-center space-y-4">
                <div className="w-24 h-24 rounded-full border border-charcoal/20 flex items-center justify-center mx-auto mb-4 bg-flame-orange/50 backdrop-blur-md">
                  <span className="text-4xl font-black text-charcoal">+</span>
                </div>
                <p className="text-xs font-bold tracking-widest uppercase text-charcoal">Thick Vanilla Shake</p>
             </div>
          </div>

          {/* Text Right */}
          <div className="md:col-span-5 space-y-6 md:pl-8 flex flex-col justify-center">
            <h3 className="text-4xl md:text-6xl font-black italic tracking-tighter leading-none">SWEET<br/>RELIEF</h3>
            <p className="text-warm-cream/60 text-sm max-w-md leading-relaxed">
              Upgrade your drink to any hand-spun milkshake. Made with real ice cream and topped with whipped cream.
            </p>
            <div className="text-2xl font-black italic text-cheddar-yellow">+$4.00</div>
            <button className="border border-warm-cream/20 px-8 py-4 rounded-full text-xs font-bold tracking-widest uppercase hover:bg-warm-cream hover:text-charcoal transition-colors mt-4 self-start">
              UPGRADE
            </button>
          </div>

        </div>
      </div>
    </section>
  );
};
