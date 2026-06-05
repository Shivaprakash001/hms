import { Button } from "../ui/button";
import { MapPin, Utensils, Shield } from "lucide-react";

export function WelcomeLanding({ onExplore }: { onExplore: () => void }) {
  const handleWhatsApp = () => {
    window.open("https://wa.me/YOUR_PHONE_NUMBER", "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--warm-ivory)]">
      {/* Logo Header */}
      <div className="pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--brand-saffron)] flex items-center justify-center">
            <div className="w-6 h-6 bg-[var(--alert-amber)] rounded-full"></div>
          </div>
          <h1 className="text-3xl font-bold text-[var(--brand-navy)]" style={{ fontFamily: 'var(--font-hero)' }}>
            Sri Adithya
          </h1>
        </div>
      </div>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col justify-center px-6">
        <div className="max-w-lg mx-auto w-full">
          {/* Hero Visual Placeholder */}
          <div className="mb-8 rounded-3xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/10 flex items-center justify-center border-2 border-[var(--brand-saffron)]/20">
            <div className="text-center text-[var(--neutral-gray)]">
              <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-[var(--brand-saffron)]/30 flex items-center justify-center">
                <svg className="w-12 h-12 text-[var(--brand-saffron)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <p className="text-sm">Hostel exterior photo</p>
            </div>
          </div>

          {/* Hero Copy */}
          <div className="text-center mb-8">
            <h2
              className="text-4xl md:text-5xl font-bold mb-4 text-[var(--brand-navy)]"
              style={{ fontFamily: 'var(--font-hero)' }}
            >
              Your Home Near SNIST
            </h2>
            <p className="text-lg text-[var(--neutral-gray)] mb-8">
              Just 400m from college. Homely food. Safe & comfortable.
            </p>
          </div>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-4 mb-8 text-sm text-[var(--deep-charcoal)] flex-wrap">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--brand-saffron)]" />
              <span>400m from SNIST</span>
            </div>
            <span className="text-[var(--neutral-gray)]">·</span>
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[var(--brand-saffron)]" />
              <span>Meals Included</span>
            </div>
            <span className="text-[var(--neutral-gray)]">·</span>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--brand-saffron)]" />
              <span>24/7 Security</span>
            </div>
          </div>

          {/* Main CTA */}
          <Button
            onClick={onExplore}
            className="w-full h-14 text-lg font-semibold bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron)]/90 text-white rounded-2xl shadow-lg"
          >
            Explore Hostel →
          </Button>

          {/* Secondary Link */}
          <button
            onClick={handleWhatsApp}
            className="w-full mt-4 text-[var(--neutral-gray)] hover:text-[var(--brand-navy)] transition-colors"
          >
            Already visited? Contact us directly
          </button>
        </div>
      </div>
    </div>
  );
}
