import { Phone, MessageCircle, Star, Building2, MapPin } from 'lucide-react';

export function Hero() {
  return (
    <section id="home" className="bg-gradient-to-b from-[#FFFDF5] to-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1
              className="text-4xl md:text-6xl text-[#1B2D5B] leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Feel at Home, Every Day
            </h1>
            <p className="text-lg md:text-xl text-[#2C2C2A]">
              Premium boys hostel, just 5 mins walk from SNIST — with homely food included
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="tel:9392433422"
                className="flex items-center gap-2 bg-[#F07B1D] text-white px-8 py-4 rounded-lg hover:bg-[#d96e18] transition-colors shadow-lg"
              >
                <Phone className="w-5 h-5" />
                <span className="font-semibold">Call Now</span>
              </a>
              <a
                href="https://wa.me/919392433422"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#1B2D5B] text-white px-8 py-4 rounded-lg hover:bg-[#152442] transition-colors shadow-lg"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="font-semibold">WhatsApp Us</span>
              </a>
            </div>

            <div className="flex flex-wrap gap-6 pt-4">
              <div className="flex items-center gap-2 text-[#2C2C2A]">
                <Star className="w-5 h-5 text-[#FBB040] fill-[#FBB040]" />
                <span>Homely Food Included</span>
              </div>
              <div className="flex items-center gap-2 text-[#2C2C2A]">
                <Building2 className="w-5 h-5 text-[#F07B1D]" />
                <span>2 Hostel Buildings</span>
              </div>
              <div className="flex items-center gap-2 text-[#2C2C2A]">
                <MapPin className="w-5 h-5 text-[#F07B1D]" />
                <span>400m from SNIST</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] bg-gradient-to-br from-[#F07B1D]/20 to-[#1B2D5B]/20 rounded-2xl shadow-2xl overflow-hidden">
              <div className="w-full h-full flex items-center justify-center text-[#1B2D5B]/20">
                <Building2 className="w-32 h-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
