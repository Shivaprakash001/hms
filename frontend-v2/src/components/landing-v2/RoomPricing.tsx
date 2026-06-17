import { Check, MessageCircle } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import type { LandingAvailability } from './landingTypes';
import type { FacilityContent, MarketingImage } from '@lib/sanity/landingContent';

export function RoomPricing({
  availability,
  facilities,
  roomInclusions,
  totalCostClarityText,
  roomTypeTitle,
  roomImage,
}: {
  availability?: LandingAvailability;
  facilities?: FacilityContent[];
  roomInclusions?: string[];
  totalCostClarityText?: string;
  roomTypeTitle?: string;
  roomImage?: MarketingImage;
}) {
  const included = roomInclusions && roomInclusions.length > 0
    ? roomInclusions
    : (facilities?.filter((facility) => facility?.title).slice(0, 8).map((facility) => facility.title) || []);

  const cleanPrice = availability?.startingPrice || 8000;
  const formattedPrice = `₹${Number(cleanPrice).toLocaleString('en-IN')}`;

  const clarityText = (totalCostClarityText || "No hidden fees. Current rent is confirmed from live HMS room pricing. {{price}} is the current starting price.")
    .replace('{{price}}', formattedPrice)
    .replace('8000', Number(cleanPrice).toLocaleString('en-IN'));

  const imageSrc = roomImage?.url || "/hostel_room.png";
  const imageAlt = roomImage?.alt || "Modern boys student hostel room";

  return (
    <section id="rooms" className="py-10 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4 font-bold"
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
              <div className={`aspect-[16/9] relative overflow-hidden ${availability?.hasLiveAvailability ? 'mt-10' : ''}`}>
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>

              <div className="p-8">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <h3 className="text-2xl font-bold text-[#1B2D5B]">{roomTypeTitle || '4-Sharing Room'}</h3>
                  <div className="text-right">
                    <div
                      className="text-4xl font-extrabold text-[#F07B1D]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {formattedPrice}
                    </div>
                    <div className="text-xs font-semibold text-[#2C2C2A]/70 mt-1">
                      Rent starts at {formattedPrice}/mo
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  {included.length > 0 && (
                    <>
                      <h4 className="font-semibold text-[#1B2D5B] mb-4">What's Included:</h4>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {included.map((item, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-[#F07B1D] flex-shrink-0 mt-0.5" />
                            <span className="text-[#2C2C2A] text-sm font-medium">{item}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="bg-[#FFFDF5] border border-[#F07B1D]/20 rounded-lg p-4 mt-4">
                    <h5 className="font-semibold text-[#1B2D5B] text-sm mb-2">Total Cost Clarity</h5>
                    <p className="text-[#2C2C2A]/85 text-sm">
                      {clarityText}
                    </p>
                  </div>
                </div>

                <a
                  href="https://api.whatsapp.com/send?phone=919392433422&text=Hi%2C%20I%27m%20interested%20in%20booking%20a%204-sharing%20room"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#F07B1D] text-white py-4 rounded-lg hover:bg-[#d96e18] transition-colors font-semibold shadow-lg"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>WhatsApp to Book</span>
                </a>
                <p className="text-sm text-[#2C2C2A]/60 italic text-center mt-3 font-medium">
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
