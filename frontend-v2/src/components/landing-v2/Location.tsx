import { MapPin, Navigation } from 'lucide-react';
import { ScrollReveal, StaggerReveal, StaggerItem } from './ScrollReveal';
import type { HostelProfileContent } from '@lib/sanity/landingContent';
import { fallbackLandingContent } from '@lib/sanity/client';

export function Location({
  hostelProfile = fallbackLandingContent.hostelProfile,
}: {
  hostelProfile?: HostelProfileContent;
}) {
  const profile = { ...fallbackLandingContent.hostelProfile, ...hostelProfile };
  const addressLines = profile.addressLines?.length ? profile.addressLines : fallbackLandingContent.hostelProfile.addressLines || [];
  const mapsUrl = profile.googleMapsUrl || fallbackLandingContent.hostelProfile.googleMapsUrl || '#';
  const embedUrl = profile.googleMapsEmbedUrl || fallbackLandingContent.hostelProfile.googleMapsEmbedUrl || '';

  return (
    <section id="location" className="py-16 md:py-24 bg-[#FFFDF5]">
      <div className="max-w-7xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {profile.locationTitle || 'Prime Location'}
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
            {profile.locationDescription || 'Conveniently located near SNIST — your daily commute is just a 5-minute walk'}
          </p>
        </ScrollReveal>

        <StaggerReveal>
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <StaggerItem>
              <div className="bg-white p-8 rounded-xl shadow-lg space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#F07B1D] rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#1B2D5B] mb-2">Address</h3>
                    <p className="text-[#2C2C2A]">
                      {addressLines.map((line) => (
                        <span key={line}>
                          {line}
                          <br />
                        </span>
                      ))}
                    </p>
                  </div>
                </div>

                <div className="bg-[#FBB040]/10 border border-[#FBB040] rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Navigation className="w-6 h-6 text-[#F07B1D]" />
                    <div>
                      <div className="font-semibold text-[#1B2D5B]">{profile.distanceTitle || 'Just 400m from SNIST'}</div>
                      <div className="text-sm text-[#2C2C2A]">{profile.distanceDescription || '5 minute walk to campus gate'}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#1B2D5B] text-white py-3 rounded-lg hover:bg-[#152442] transition-colors"
                  >
                    <MapPin className="w-5 h-5" />
                    <span>Get Directions</span>
                  </a>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="rounded-xl overflow-hidden shadow-lg h-[400px]">
                <iframe
                  src={embedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`${profile.name || 'Sri Adithya Hostels'} Location`}
                />
              </div>
            </StaggerItem>
          </div>
        </StaggerReveal>
      </div>
    </section>
  );
}
