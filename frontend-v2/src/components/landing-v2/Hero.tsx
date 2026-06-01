import { Phone, MessageCircle, MapPin, UtensilsCrossed, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { ImageCarousel } from './ImageCarousel';
import ownerPhoto from './assets/person__up-removebg-preview__1_.png';
import type { LandingAvailability } from './landingTypes';

export function Hero({ availability }: { availability?: LandingAvailability }) {
  return (
    <section id="home" className="bg-gradient-to-b from-[#FFFDF5] to-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-[55%_45%] gap-12 items-center">
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <motion.div
                className="relative flex-shrink-0"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <div className="relative w-24 h-28 md:w-28 md:h-32">
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-[#F07B1D]/10 to-[#1B2D5B]/10 border-4 border-white shadow-xl" />
                  <img
                    src={ownerPhoto}
                    alt="Srinivasa Rao - Owner"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-white shadow-xl"
                  />
                </div>
              </motion.div>

              <motion.div
                className="inline-flex items-center gap-2 bg-[#1B2D5B] text-white px-4 py-2 rounded-full text-sm border-l-4 border-[#F07B1D]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
              >
                Trusted by SNIST students since 2019
              </motion.div>
            </div>

            <motion.div
              className="mt-6"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <h1
                className="text-4xl md:text-5xl lg:text-6xl text-[#1B2D5B] leading-tight mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Feel at Home, Every Day
              </h1>
              <p className="text-xl md:text-2xl text-[#2C2C2A] leading-relaxed">
                Boys hostel, just 5 mins walk from SNIST
              </p>
            </motion.div>

            <motion.p
              className="text-base md:text-lg text-[#2C2C2A]/80 pt-4"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            >
              Join 78+ SNIST students — <strong className="text-[#1B2D5B]">₹8,000/month</strong>, everything included.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-4 pt-6"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <a
                href={availability?.visitUrl || 'tel:9392433422'}
                className="flex items-center gap-2 bg-[#F07B1D] text-white px-8 py-4 rounded-lg hover:bg-[#d96e18] transition-colors shadow-lg font-semibold"
              >
                <Phone className="w-5 h-5" />
                <span>Book a Room Visit</span>
              </a>
              <a
                href="https://wa.me/919392433422"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white text-[#1B2D5B] border-l-4 border-green-500 px-8 py-4 rounded-lg hover:shadow-lg transition-all shadow-md font-semibold"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Check Availability on WhatsApp</span>
              </a>
            </motion.div>

            <motion.div
              className="flex flex-wrap gap-4 pt-8 border-t border-[#F07B1D]/20 mt-8"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="flex items-center gap-2 text-[#2C2C2A] text-sm">
                <UtensilsCrossed className="w-4 h-4 text-[#F07B1D]" />
                <span>Meals Included</span>
              </div>
              <div className="h-4 w-px bg-[#F07B1D]/30" />
              <div className="flex items-center gap-2 text-[#2C2C2A] text-sm">
                <Shield className="w-4 h-4 text-[#F07B1D]" />
                <span>CCTV + Warden</span>
              </div>
              <div className="h-4 w-px bg-[#F07B1D]/30" />
              <div className="flex items-center gap-2 text-[#2C2C2A] text-sm">
                <MapPin className="w-4 h-4 text-[#F07B1D]" />
                <span>400m from SNIST</span>
              </div>
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
            <ImageCarousel />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
