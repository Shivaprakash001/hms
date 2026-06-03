import { Check, MessageCircle, Bed } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import type { LandingAvailability } from './landingTypes';

export function RoomPricing({ availability }: { availability?: LandingAvailability }) {
  const included = [
    'Comfortable bed with mattress',
    'Attached bathroom facilities',
    'Daily housekeeping',
    '3 meals per day included',
    'Free WiFi access',
    '24/7 security',
    'Hot water facility',
    'Common area access'
  ];

  return (
    <section id="rooms" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Rooms & Pricing
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
            Affordable accommodation with all amenities included
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#FFFDF5] rounded-2xl shadow-xl overflow-hidden border-2 border-[#F07B1D] relative">
              {availability?.hasLiveAvailability && (
                <div className="absolute top-0 left-0 right-0 bg-[#F07B1D] text-white text-center py-2 text-sm font-medium z-10">
                  Only {availability.bedsAvailable} beds available this month
                </div>
              )}
              <div className={`aspect-[16/9] bg-gradient-to-br from-[#F07B1D]/20 to-[#1B2D5B]/20 relative overflow-hidden ${availability?.hasLiveAvailability ? 'mt-10' : ''}`}>
                <div className="absolute inset-0 flex items-center justify-center text-[#1B2D5B]/20">
                  <Bed className="w-32 h-32" />
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-semibold text-[#1B2D5B]">4-Sharing Room</h3>
                  <div className="text-right">
                    <div
                      className="text-4xl font-bold text-[#F07B1D]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      ₹8,000
                    </div>
                    <div className="text-sm text-[#2C2C2A]">per month</div>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="font-semibold text-[#1B2D5B] mb-4">What's Included:</h4>
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {included.map((item, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-[#F07B1D] flex-shrink-0 mt-0.5" />
                        <span className="text-[#2C2C2A] text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#FFFDF5] border border-[#F07B1D]/20 rounded-lg p-4 mt-4">
                    <h5 className="font-semibold text-[#1B2D5B] text-sm mb-2">Total Cost Clarity</h5>
                    <p className="text-[#2C2C2A]/80 text-sm">
                      No electricity charges. No maintenance extra. No hidden fees. <strong className="text-[#F07B1D]">₹8,000</strong> is everything.
                    </p>
                  </div>
                </div>

                <a
                  href="https://api.whatsapp.com/send?phone=919392433422&text=Hi%2C%20I%27m%20interested%20in%20booking%20a%204-sharing%20room"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#F07B1D] text-white py-4 rounded-lg hover:bg-[#d96e18] transition-colors font-semibold"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>WhatsApp to Book</span>
                </a>
                <p className="text-sm text-[#2C2C2A]/60 italic text-center mt-3">
                  {availability?.hasLiveAvailability ? 'Availability updates from live admissions data' : 'Contact us to check current availability'}
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
