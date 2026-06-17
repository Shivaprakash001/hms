import { Phone, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { VideoPlayer } from './VideoPlayer';
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
  let supportingCopy = content.supportingCopy || 'Join SNIST students';
  if (startingPriceText) {
    const hasPrice = supportingCopy.includes('₹') || supportingCopy.toLowerCase().includes('/month');
    if (!hasPrice) {
      const cleanCopy = supportingCopy.replace(/[,.]?\s*everything\s+included\.?/gi, '').trim();
      supportingCopy = `${cleanCopy} — ${startingPriceText}/month, everything included.`;
    }
  }
  const primaryHref = availability?.visitUrl || content.primaryCta?.href || '#contact';
  const secondaryHref = content.secondaryCta?.href || 'https://api.whatsapp.com/send?phone=919392433422';

  const ownerPhotoUrl = content.ownerImage?.url || ownerPhoto;

  return (
    <section id="home" className="bg-gradient-to-b from-[#FFFDF5] to-white py-10 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-[55%_45%] gap-12 items-center">
          <div className="space-y-10">
            {/* Owner Photo and Trust Badges Block */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left w-full justify-center sm:justify-start">
              <motion.div
                className="relative flex-shrink-0"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <div className="relative w-24 h-28 md:w-28 md:h-32">
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-[#F07B1D]/10 to-[#1B2D5B]/10 border-4 border-white shadow-xl" />
                  <img
                    src={ownerPhotoUrl}
                    alt="Hostel Owner"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-white shadow-xl"
                  />
                </div>
              </motion.div>

              <div className="flex flex-col items-center sm:items-start gap-2">
                <motion.div
                  className="hidden md:inline-flex items-center gap-2 bg-[#1B2D5B] text-white px-4 py-2 rounded-full text-sm border-l-4 border-[#F07B1D] font-medium"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  {content.trustBadge || 'I personally respond to every enquiry.'}
                </motion.div>
                <motion.div
                  className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-full text-sm font-semibold shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  {availability?.hasLiveAvailability ? (
                    <span>🔥 {availability?.bedsAvailable} beds available for {availability?.intakeMonth} intake</span>
                  ) : (
                    <span>⭐ Top Rated Student Choice near SNIST Campus</span>
                  )}
                </motion.div>
              </div>
            </div>

            {/* Title section */}
            <motion.div
              className="text-center sm:text-left"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="relative inline-block py-2">
                <div className="absolute -left-[22%] -right-[22%] -top-[35%] -bottom-[35%] pointer-events-none select-none z-0">
                  <motion.svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 1200 600"
                    initial="hidden"
                    animate="visible"
                    preserveAspectRatio="none"
                    className="w-full h-full text-[#F07B1D] opacity-40"
                  >
                    <motion.path
                      d="M 950 90 
                         C 1250 300, 1050 480, 600 520
                         C 250 520, 150 480, 150 300
                         C 150 120, 350 80, 600 80
                         C 850 80, 950 180, 950 180"
                      fill="none"
                      strokeWidth="10"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      variants={{
                        hidden: { pathLength: 0, opacity: 0 },
                        visible: {
                          pathLength: 1,
                          opacity: 1,
                          transition: {
                            pathLength: { duration: 2.5, ease: [0.43, 0.13, 0.23, 0.96] },
                            opacity: { duration: 0.5 },
                          },
                        },
                      }}
                    />
                  </motion.svg>
                </div>
                <h1
                  className="relative z-10 text-[28px] sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#1B2D5B] leading-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {content.title || '400m from SNIST. Home Food. Everything Included.'}
                </h1>
              </div>
            </motion.div>

            {/* Badges, description, and actions */}
            <div className="space-y-6">
              {supportingCopy && (
                <motion.p
                  className="text-base md:text-lg text-[#2C2C2A]/80 text-center sm:text-left font-medium"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  {supportingCopy}
                </motion.p>
              )}

              <div>
                <motion.div
                  className="flex flex-col sm:flex-row gap-4 pt-2"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  <a
                    href={primaryHref}
                    className="flex items-center justify-center gap-2 bg-[#F07B1D] text-white px-8 py-4 rounded-lg hover:bg-[#d96e18] transition-all duration-300 hover:scale-[1.02] shadow-lg font-semibold w-full sm:w-auto text-center"
                  >
                    <Phone className="w-5 h-5" />
                    <span>{content.primaryCtaText || content.primaryCta?.label || 'Book a Room Visit'}</span>
                  </a>
                  <a
                    href={secondaryHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-white text-[#1B2D5B] border-l-4 border-green-500 px-8 py-4 rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-[1.02] shadow-md font-semibold w-full sm:w-auto text-center"
                  >
                    <MessageCircle className="w-5 h-5 text-green-500" />
                    <span>{content.secondaryCtaText || content.secondaryCta?.label || 'Check Availability on WhatsApp'}</span>
                  </a>
                </motion.div>
                {availability?.hasLiveAvailability && (
                  <motion.p
                    className="text-sm italic text-red-600 font-bold mt-3 text-center sm:text-left"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                  >
                    ⚡ Only a few beds available for {availability.intakeMonth} — confirm early
                  </motion.p>
                )}
              </div>

              <motion.div
                className="flex flex-wrap gap-2.5 pt-6 border-t border-[#F07B1D]/20 mt-6 justify-center sm:justify-start"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
              >
                {content.highlights.map((highlight) => {
                  const Icon = highlightIcon(highlight);
                  return (
                    <div
                      key={highlight}
                      className="flex items-center gap-1.5 text-[#2C2C2A] text-xs bg-[#FFFDF5] border border-[#F07B1D]/15 px-3 py-1.5 rounded-full shadow-sm"
                    >
                      <Icon className="w-3.5 h-3.5 text-[#F07B1D]" />
                      <span className="font-semibold">{highlight}</span>
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
            className="space-y-4"
          >
            <VideoPlayer videos={content.tourVideos} />
            <p className="text-base md:text-lg text-[#2C2C2A] font-semibold leading-relaxed text-center bg-[#FFFDF5] border border-[#F07B1D]/15 p-4 rounded-xl shadow-sm">
              {content.subtitle}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
