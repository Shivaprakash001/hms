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
    <div className="bg-[#1B2D5B] text-white py-2 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center md:justify-between gap-4 text-sm">
        <div className="flex items-center gap-6">
          <a href={`tel:${phone}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Phone className="w-4 h-4" />
            <span>{phone}</span>
          </a>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{shortLocation}</span>
          </div>
        </div>
        <a
          href={`https://api.whatsapp.com/send?phone=${whatsappNumber}`}
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
