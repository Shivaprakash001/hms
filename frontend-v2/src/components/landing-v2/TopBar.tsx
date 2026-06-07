import { Phone, MapPin, MessageCircle } from 'lucide-react';
import type { HostelProfileContent } from '@lib/sanity/landingContent';
import { fallbackLandingContent } from '@lib/sanity/client';

export function TopBar({
  hostelProfile = fallbackLandingContent.hostelProfile,
}: {
  hostelProfile?: HostelProfileContent;
}) {
  const phone = hostelProfile.phone || fallbackLandingContent.hostelProfile.phone || '9392433422';
  const whatsappNumber = hostelProfile.whatsappNumber || fallbackLandingContent.hostelProfile.whatsappNumber || '919392433422';
  const shortLocation = hostelProfile.shortLocation || fallbackLandingContent.hostelProfile.shortLocation || 'Yamnampet, Secunderabad';

  return (
    <div className="bg-[#1B2D5B] text-white h-[44px] md:h-auto flex items-center px-4 py-1">
      <div className="max-w-7xl mx-auto flex w-full items-center justify-between gap-2 text-xs md:text-sm">
        <div className="flex items-center gap-3 md:gap-6">
          <a href="tel:9392433422" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Phone className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span>9392433422</span>
          </a>
          <div className="hidden sm:flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="truncate max-w-[120px] sm:max-w-none">{shortLocation}</span>
          </div>
        </div>
        <a
          href="https://wa.me/919392433422?text=Hi%20Srinivasa%20Rao%2C%20I%27m%20interested%20in%20a%20hostel%20room"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:opacity-80 transition-opacity whitespace-nowrap bg-[#F07B1D] px-2.5 py-1 rounded text-white font-semibold text-[10px] md:text-xs"
        >
          <MessageCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span>WhatsApp Us</span>
        </a>
      </div>
    </div>
  );
}
