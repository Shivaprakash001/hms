import { Phone, MapPin, MessageCircle } from 'lucide-react';

export function TopBar() {
  return (
    <div className="bg-[#1B2D5B] text-white py-2 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center md:justify-between gap-4 text-sm">
        <div className="flex items-center gap-6">
          <a href="tel:9392433422" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Phone className="w-4 h-4" />
            <span>9392433422</span>
          </a>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>Yamnampet, Secunderabad</span>
          </div>
        </div>
        <a
          href="https://wa.me/919392433422"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <MessageCircle className="w-4 h-4" />
          <span>WhatsApp Us</span>
        </a>
      </div>
    </div>
  );
}
