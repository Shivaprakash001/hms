import { Check, MessageCircle, Bed } from 'lucide-react';

export function RoomPricing() {
  const included = [
    'Comfortable bed with mattress',
    'Study table and chair',
    'Attached bathroom facilities',
    'Daily housekeeping',
    '3 meals per day included',
    'Free WiFi access',
    '24/7 security',
    'Hot water facility',
    'Common area access',
  ];

  return (
    <section id="rooms" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2
          className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Rooms & Pricing
        </h2>
        <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
          Affordable accommodation with all amenities included
        </p>

        <div className="max-w-2xl mx-auto">
          <div className="bg-[#FFFDF5] rounded-2xl shadow-xl overflow-hidden border-2 border-[#F07B1D]">
            <div className="aspect-[16/9] bg-gradient-to-br from-[#F07B1D]/20 to-[#1B2D5B]/20 relative overflow-hidden">
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
                    ₹8,200
                  </div>
                  <div className="text-sm text-[#2C2C2A]">per month</div>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="font-semibold text-[#1B2D5B] mb-4">What's Included:</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {included.map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-[#F07B1D] flex-shrink-0 mt-0.5" />
                      <span className="text-[#2C2C2A] text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href="https://wa.me/919392433422?text=Hi%2C%20I%27m%20interested%20in%20booking%20a%204-sharing%20room"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#F07B1D] text-white py-4 rounded-lg hover:bg-[#d96e18] transition-colors font-semibold"
              >
                <MessageCircle className="w-5 h-5" />
                <span>WhatsApp to Book</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
