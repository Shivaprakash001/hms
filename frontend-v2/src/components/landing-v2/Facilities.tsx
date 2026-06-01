import { Wifi, Droplet, Sparkles, Shield, Cctv, WashingMachine, Lock, Zap, UtensilsCrossed } from 'lucide-react';
import { ScrollReveal, StaggerReveal, StaggerItem } from './ScrollReveal';

export function Facilities() {
  const facilities = [
    { icon: Wifi, label: 'Free WiFi' },
    { icon: Droplet, label: 'Hot Water' },
    { icon: Sparkles, label: 'Daily Cleaning' },
    { icon: Shield, label: 'Warden Security' },
    { icon: Cctv, label: '24/7 CCTV' },
    { icon: WashingMachine, label: 'Washing Machine' },
    { icon: Lock, label: 'Secure Storage' },
    { icon: Zap, label: 'Emergency Generator' },
    { icon: UtensilsCrossed, label: 'Meals Included' }
  ];

  return (
    <section id="facilities" className="py-16 md:py-24 bg-[#FFFDF5]">
      <div className="max-w-7xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Facilities & Amenities
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
            Everything you need for comfortable and secure hostel living
          </p>
        </ScrollReveal>

        <StaggerReveal staggerDelay={0.08}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {facilities.map((facility, index) => {
              const Icon = facility.icon;
              return (
                <StaggerItem key={index}>
                  <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col items-center text-center border border-[#F07B1D]/10">
                    <div className="w-14 h-14 bg-[#F07B1D]/10 rounded-full flex items-center justify-center mb-4">
                      <Icon className="w-7 h-7 text-[#F07B1D]" />
                    </div>
                    <span className="text-[#2C2C2A] font-medium">{facility.label}</span>
                  </div>
                </StaggerItem>
              );
            })}
          </div>
        </StaggerReveal>
      </div>
    </section>
  );
}
