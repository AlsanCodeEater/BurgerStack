import React from 'react';
import { Instagram, MapPin, Phone, Mail, Clock } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-charcoal text-warm-cream py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12">
        
        <div className="col-span-1 md:col-span-1">
          <a href="#" className="text-3xl font-black italic tracking-tighter block mb-6">
            STACKED<span className="text-tomato-red">.</span>
          </a>
          <p className="text-warm-cream/40 text-xs max-w-xs mb-6 leading-relaxed font-bold tracking-widest uppercase">
            Flame grilled. Built fresh. Impossible to ignore. We don't take shortcuts when it comes to burgers.
          </p>
          <div className="flex space-x-4">
            <a href="#" className="w-10 h-10 rounded-full border border-warm-cream/10 flex items-center justify-center hover:bg-tomato-red hover:border-transparent hover:text-warm-cream text-warm-cream/60 transition-colors">
              <Instagram size={16} />
            </a>
            {/* TikTok Icon placeholder using SVG */}
            <a href="#" className="w-10 h-10 rounded-full border border-warm-cream/10 flex items-center justify-center hover:bg-tomato-red hover:border-transparent hover:text-warm-cream text-warm-cream/60 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-warm-cream/40 mb-6">MENU</h4>
          <ul className="space-y-4 text-warm-cream/80 text-xs tracking-widest uppercase font-bold">
            <li><a href="#" className="hover:text-flame-orange transition-colors">Classic Burgers</a></li>
            <li><a href="#" className="hover:text-flame-orange transition-colors">Plant Based</a></li>
            <li><a href="#" className="hover:text-flame-orange transition-colors">Sides & Fries</a></li>
            <li><a href="#" className="hover:text-flame-orange transition-colors">Shakes & Drinks</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-warm-cream/40 mb-6">LOCATIONS</h4>
          <ul className="space-y-4 text-warm-cream/80 text-xs tracking-widest uppercase font-bold">
            <li className="flex items-start space-x-3">
              <MapPin size={16} className="text-flame-orange shrink-0 mt-0.5" />
              <span className="leading-relaxed">123 Burger Lane<br/>Downtown, DT 90210</span>
            </li>
            <li className="flex items-start space-x-3">
              <MapPin size={16} className="text-flame-orange shrink-0 mt-0.5" />
              <span className="leading-relaxed">456 Grill Street<br/>Westside, WS 90211</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-warm-cream/40 mb-6">CONTACT & HOURS</h4>
          <ul className="space-y-4 text-warm-cream/80 text-xs tracking-widest uppercase font-bold">
            <li className="flex items-center space-x-3">
              <Phone size={16} className="text-flame-orange" />
              <span>1-800-STACKED</span>
            </li>
            <li className="flex items-center space-x-3">
              <Mail size={16} className="text-flame-orange" />
              <span className="normal-case">hello@stackedburgers.com</span>
            </li>
            <li className="flex items-start space-x-3 mt-4">
              <Clock size={16} className="text-flame-orange shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Mon-Thu: 11am - 10pm<br/>
                Fri-Sat: 11am - 12am<br/>
                Sun: 12pm - 9pm
              </span>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-16 pt-8 border-t border-warm-cream/5 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-warm-cream/30 text-[10px] font-bold tracking-widest uppercase">
        <p>&copy; {new Date().getFullYear()} Stacked Burgers. All rights reserved.</p>
        <div className="space-x-6 mt-4 md:mt-0">
          <a href="#" className="hover:text-warm-cream transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-warm-cream transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};
