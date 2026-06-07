import { Phone, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { ImageCarousel } from './ImageCarousel';
import ownerPhoto from './assets/person__up-removebg-preview__1_.png';
import type { LandingAvailability } from './landingTypes';
import type { HeroContent } from '@lib/sanity/landingContent';
import { getLandingIcon } from './content/icons';

function rupee(value: number | null | undefined) {
  if (!value) return null;
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function highlightIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('meal') || normalized.includes('food')) return getLandingIcon('food');
  if (normalized.includes('cctv') || normalized.includes('warden') || normalized.includes('security')) return getLandingIcon('security');
  if (normalized.includes('snist') || normalized.includes('walk') || normalized.includes('location')) return getLandingIcon('location');
  return getLandingIcon('home');
}

export function Hero({ availability, content }: { availability?: LandingAvailability; content: HeroContent }) {
  const startingPriceText = rupee(availability?.startingPrice || 8000);
  const supportingCopy = startingPriceText
    ? `${content.supportingCopy || 'Join SNIST students'} — ${startingPriceText}/month, everything included.`
    : content.supportingCopy;
  const primaryHref = availability?.visitUrl || content.primaryCta?.href || '#contact';
  const secondaryHref = content.secondaryCta?.href || 'https://api.whatsapp.com/send?phone=919392433422';

  return (
    <section id="home" className="bg-gradient-to-b from-[#FFFDF5] to-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-[55%_45%] gap-12 items-center">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-4">
              <motion.div
                className="relative flex-shrink-0"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <div className="relative w-24 h-28 md:w-28 md:h-32">
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-[#F07B1D]/10 to-[#1B2D5B]/10 border-4 border-white shadow-xl" />
                  <img
                    src={content.ownerImage?.url || ownerPhoto}
                    alt={content.ownerImage?.alt || 'Srinivasa Rao - Owner'}
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-white shadow-xl"
                  />
                </div>
              </motion.div>

              <div className="flex flex-col gap-2">
                <motion.div
                  className="inline-flex items-center gap-2 bg-[#1B2D5B] text-white px-4 py-2 rounded-full text-sm border-l-4 border-[#F07B1D] font-medium"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  {content.trustBadge}
                </motion.div>
                <motion.div
                  className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-full text-sm font-semibold"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  <span>78+ SNIST students already live here</span>
                </motion.div>
              </div>
            </div>

            <motion.div
              className="mt-6"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#1B2D5B] leading-tight mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                400m from SNIST. Home Food. Everything Included.
              </h1>
              <p className="text-xl md:text-2xl text-[#2C2C2A] leading-relaxed">
                {content.subtitle}
              </p>
            </motion.div>

            {supportingCopy && (
              <motion.p
                className="text-base md:text-lg text-[#2C2C2A]/80 pt-4"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
              >
                {supportingCopy}
              </motion.p>
            )}

            <div>
              <motion.div
                className="flex flex-wrap gap-4 pt-6"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <a
                  href={primaryHref}
                  className="flex items-center gap-2 bg-[#F07B1D] text-white px-8 py-4 rounded-lg hover:bg-[#d96e18] transition-colors shadow-lg font-semibold"
                >
                  <Phone className="w-5 h-5" />
                  <span>{content.primaryCta?.label || 'Book a Room Visit'}</span>
                </a>
                <a
                  href={secondaryHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white text-[#1B2D5B] border-l-4 border-green-500 px-8 py-4 rounded-lg hover:shadow-lg transition-all shadow-md font-semibold"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>{content.secondaryCta?.label || 'Check Availability on WhatsApp'}</span>
                </a>
              </motion.div>
              <motion.p
                className="text-sm italic text-red-600 font-semibold mt-3 ml-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                ⚡ Only a few beds available for {availability?.intakeMonth || 'this month'} — confirm early
              </motion.p>
            </div>

            <motion.div
              className="flex flex-wrap gap-4 pt-8 border-t border-[#F07B1D]/20 mt-8"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            >
              {content.highlights.map((highlight, index) => {
                const Icon = highlightIcon(highlight);
                return (
                  <div key={highlight} className="contents">
                    {index > 0 && <div className="h-4 w-px bg-[#F07B1D]/30" />}
                    <div className="flex items-center gap-2 text-[#2C2C2A] text-sm">
                      <Icon className="w-4 h-4 text-[#F07B1D]" />
                      <span>{highlight}</span>
                    </div>
                  </div>
                );
              })}
              {availability?.hasLiveAvailability && (
                <>
                  <div className="h-4 w-px bg-[#F07B1D]/30" />
                  <div className="flex items-center gap-2 text-red-600 font-medium text-sm">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                    <span>{availability.bedsAvailable} beds left for {availability.intakeMonth}</span>
                  </div>
                </>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
        >
            <ImageCarousel images={content.carouselImages} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
