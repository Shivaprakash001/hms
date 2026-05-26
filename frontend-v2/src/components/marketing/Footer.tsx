import { Phone, MapPin, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#1B2D5B] text-white py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/android-chrome-512x512.png"
                alt="Adithya Boys Hostel"
                className="h-[72px] w-auto object-contain brightness-0 invert"
              />
              <span
                className="text-lg font-bold text-white leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Sri Adithya<br />Hostels
              </span>
            </div>
            <p className="text-white/80 text-sm">
              Your home away from home — providing comfortable, safe, and affordable accommodation
              for students near SNIST.
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
              <Link
                to="/legal"
                className="block text-white/80 hover:text-white transition-colors text-sm no-underline"
              >
                Legal
              </Link>
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

        <div className="border-t border-white/20 pt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-white/60">
          <p className="m-0">&copy; {new Date().getFullYear()} Sri Adithya Hostels. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/legal" className="text-white/60 hover:text-white transition-colors no-underline">
              Legal
            </Link>
            <Link to="/login" className="text-white/60 hover:text-white transition-colors no-underline">
              Tenant Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
