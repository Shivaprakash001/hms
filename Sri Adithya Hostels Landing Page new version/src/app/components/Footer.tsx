import { Home, Phone, MapPin, MessageCircle } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import hostelLogo from '../../imports/hostel_icon.jpeg';

export function Footer() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#1B2D5B] text-white py-12">
      <ScrollReveal>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white flex items-center justify-center">
                <img
                  src={hostelLogo}
                  alt="Sri Adithya Hostels Logo"
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div>
                <h3
                  className="text-xl font-semibold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Sri Adithya Hostels
                </h3>
              </div>
            </div>
            <p className="text-white/80 text-sm">
              Your home away from home — providing comfortable, safe, and affordable accommodation for students near SNIST.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <div className="space-y-2">
              <button
                onClick={() => scrollToSection('home')}
                className="block text-white/80 hover:text-white transition-colors text-sm"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('facilities')}
                className="block text-white/80 hover:text-white transition-colors text-sm"
              >
                Facilities
              </button>
              <button
                onClick={() => scrollToSection('rooms')}
                className="block text-white/80 hover:text-white transition-colors text-sm"
              >
                Rooms & Pricing
              </button>
              <button
                onClick={() => scrollToSection('location')}
                className="block text-white/80 hover:text-white transition-colors text-sm"
              >
                Location
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="block text-white/80 hover:text-white transition-colors text-sm"
              >
                Contact
              </button>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact Us</h4>
            <div className="space-y-3 text-sm">
              <a
                href="tel:9392433422"
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>9392433422</span>
              </a>
              <a
                href="https://wa.me/919392433422"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
              <div className="flex items-start gap-2 text-white/80">
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                <span>Yamnampet, Secunderabad, Telangana</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 pt-8 text-center text-sm text-white/60">
          <p>&copy; 2025 Sri Adithya Hostels. All rights reserved.</p>
        </div>
        </div>
      </ScrollReveal>
    </footer>
  );
}
