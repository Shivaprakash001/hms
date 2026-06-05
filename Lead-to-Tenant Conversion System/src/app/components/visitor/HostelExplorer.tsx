import { Phone, MessageCircle, Wifi, Utensils, Shield, Tv, Dumbbell, Wind, Users, MapPin } from "lucide-react";
import { Button } from "../ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

interface HostelExplorerProps {
  hostelName: string;
  onViewRooms: () => void;
}

export function HostelExplorer({ hostelName, onViewRooms }: HostelExplorerProps) {
  const handleCall = () => {
    window.location.href = "tel:+919876543210";
  };

  const handleWhatsApp = () => {
    window.open("https://wa.me/919876543210", "_blank");
  };

  const facilities = [
    { icon: Wifi, label: "WiFi", description: "High-speed internet in all rooms" },
    { icon: Utensils, label: "Meals", description: "3 meals daily, homely food" },
    { icon: Shield, label: "Security", description: "24/7 security with CCTV" },
    { icon: Tv, label: "TV Room", description: "Common entertainment area" },
    { icon: Dumbbell, label: "Gym", description: "Basic fitness equipment" },
    { icon: Wind, label: "AC Rooms", description: "Air conditioned rooms" },
    { icon: Users, label: "Study Room", description: "Quiet study space" },
  ];

  const weekMenu = [
    { day: "Monday", breakfast: "Idli, Sambar, Chutney", lunch: "Rice, Dal, Curry, Chapati", dinner: "Chapati, Paneer, Dal" },
    { day: "Tuesday", breakfast: "Dosa, Sambar, Chutney", lunch: "Rice, Sambar, Fry, Chapati", dinner: "Rice, Curry, Rasam" },
    { day: "Wednesday", breakfast: "Upma, Chutney", lunch: "Rice, Dal, Vegetable, Chapati", dinner: "Chapati, Dal, Curry" },
    { day: "Thursday", breakfast: "Poha, Chutney", lunch: "Rice, Sambar, Fry, Chapati", dinner: "Rice, Curry, Dal" },
    { day: "Friday", breakfast: "Idli, Chutney", lunch: "Biryani, Raita, Curry", dinner: "Chapati, Paneer, Dal" },
    { day: "Saturday", breakfast: "Dosa, Sambar", lunch: "Rice, Special Curry, Chapati", dinner: "Rice, Dal, Fry" },
    { day: "Sunday", breakfast: "Puri, Curry", lunch: "Special Meals", dinner: "Chapati, Mixed Veg" },
  ];

  const rules = [
    { title: "Entry & Exit Timings", content: "Gate closes at 9:30 PM. Late entry requires prior permission." },
    { title: "Visitors Policy", content: "Visitors allowed only in common areas. Prior intimation required." },
    { title: "Room Maintenance", content: "Keep rooms clean. Laundry service available. No cooking in rooms." },
    { title: "Noise Policy", content: "Maintain silence after 10 PM. Respect fellow residents." },
  ];

  return (
    <div className="min-h-screen bg-[var(--warm-ivory)] pb-24">
      {/* Hero Image */}
      <div className="relative h-64 bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 flex items-center justify-center">
        <div className="text-center text-[var(--neutral-gray)]">
          <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-[var(--brand-saffron)]/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--brand-saffron)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <p className="text-sm">Hostel photos carousel</p>
        </div>
      </div>

      {/* Hostel Identity */}
      <div className="px-6 -mt-8">
        <div className="bg-white rounded-2xl p-4 shadow-lg">
          <h1 className="text-xl font-bold text-[var(--brand-navy)] mb-3">{hostelName}</h1>
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 bg-[var(--brand-saffron)]/10 text-[var(--brand-saffron)] rounded-full text-sm font-medium">
              ₹8,000/mo
            </span>
            <span className="px-3 py-1 bg-[var(--brand-navy)]/10 text-[var(--brand-navy)] rounded-full text-sm">
              4-Sharing
            </span>
            <span className="px-3 py-1 bg-[var(--success-green)]/10 text-[var(--success-green)] rounded-full text-sm">
              Meals ✓
            </span>
            <span className="px-3 py-1 bg-[var(--brand-navy)]/10 text-[var(--brand-navy)] rounded-full text-sm">
              WiFi ✓
            </span>
            <span className="px-3 py-1 bg-[var(--brand-saffron)]/10 text-[var(--brand-saffron)] rounded-full text-sm">
              SNIST 400m
            </span>
          </div>
        </div>
      </div>

      {/* About Section */}
      <section className="px-6 mt-8">
        <h2 className="text-2xl font-semibold text-[var(--brand-navy)] mb-4">About</h2>
        <p className="text-[var(--neutral-gray)] leading-relaxed">
          Sri Adithya Boys Hostel offers a comfortable and safe living experience just 400m from SNIST campus.
          Our <span className="font-semibold text-[var(--deep-charcoal)]">homely food & atmosphere</span> is our most loved feature.
          We provide a peaceful environment for students to focus on their studies while enjoying quality amenities.
        </p>
      </section>

      {/* Photo Gallery */}
      <section className="px-6 mt-8">
        <h2 className="text-2xl font-semibold text-[var(--brand-navy)] mb-4">Gallery</h2>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-gradient-to-br from-[var(--brand-saffron)]/10 to-[var(--brand-navy)]/5 flex items-center justify-center overflow-hidden"
            >
              <span className="text-[var(--neutral-gray)] text-sm">Photo {i}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Facilities */}
      <section className="px-6 mt-8">
        <h2 className="text-2xl font-semibold text-[var(--brand-navy)] mb-4">Facilities</h2>
        <div className="grid grid-cols-3 gap-4">
          {facilities.map((facility) => {
            const Icon = facility.icon;
            return (
              <button
                key={facility.label}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white hover:bg-[var(--brand-saffron)]/5 transition-colors group"
              >
                <Icon className="w-8 h-8 text-[var(--brand-saffron)] group-hover:scale-110 transition-transform" />
                <span className="text-xs text-[var(--deep-charcoal)] text-center">{facility.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Food Menu */}
      <section className="px-6 mt-8">
        <h2 className="text-2xl font-semibold text-[var(--brand-navy)] mb-4">Weekly Menu</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
          {weekMenu.map((menu) => (
            <div
              key={menu.day}
              className="min-w-[280px] bg-[#FFFBF0] rounded-xl p-4 border border-[var(--brand-saffron)]/20"
            >
              <h3 className="font-semibold text-[var(--brand-navy)] mb-3">{menu.day}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-[var(--neutral-gray)] text-xs">Breakfast</span>
                  <p className="text-[var(--deep-charcoal)]">{menu.breakfast}</p>
                </div>
                <div>
                  <span className="text-[var(--neutral-gray)] text-xs">Lunch</span>
                  <p className="text-[var(--deep-charcoal)]">{menu.lunch}</p>
                </div>
                <div>
                  <span className="text-[var(--neutral-gray)] text-xs">Dinner</span>
                  <p className="text-[var(--deep-charcoal)]">{menu.dinner}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rules & Timings */}
      <section className="px-6 mt-8">
        <h2 className="text-2xl font-semibold text-[var(--brand-navy)] mb-4">Rules & Timings</h2>
        <Accordion type="single" collapsible className="bg-white rounded-xl overflow-hidden">
          {rules.map((rule, index) => (
            <AccordionItem key={index} value={`rule-${index}`} className="border-b last:border-0">
              <AccordionTrigger className="px-4 py-4 hover:bg-[var(--warm-ivory)] text-[var(--deep-charcoal)]">
                {rule.title}
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-[var(--neutral-gray)]">
                {rule.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Location */}
      <section className="px-6 mt-8 mb-8">
        <h2 className="text-2xl font-semibold text-[var(--brand-navy)] mb-4">Location</h2>
        <div className="bg-white rounded-xl p-4">
          <div className="aspect-video bg-gradient-to-br from-[var(--success-green)]/10 to-[var(--brand-navy)]/10 rounded-lg flex items-center justify-center mb-3">
            <MapPin className="w-12 h-12 text-[var(--brand-saffron)]" />
          </div>
          <Button
            variant="outline"
            className="w-full mb-2"
            onClick={() => window.open("https://maps.google.com", "_blank")}
          >
            Open in Maps
          </Button>
          <div className="inline-block px-3 py-1 bg-[var(--success-green)]/10 text-[var(--success-green)] rounded-full text-sm font-medium">
            5 min walk from SNIST Gate
          </div>
        </div>
      </section>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border)] p-4 shadow-lg">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={handleCall}
            className="flex items-center gap-2 px-4 py-3 bg-[var(--warm-ivory)] rounded-xl hover:bg-[var(--brand-navy)]/5 transition-colors"
          >
            <Phone className="w-5 h-5 text-[var(--brand-navy)]" />
            <span className="text-sm font-medium text-[var(--brand-navy)]">Call</span>
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-2 px-4 py-3 bg-[var(--warm-ivory)] rounded-xl hover:bg-[var(--success-green)]/5 transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-[var(--success-green)]" />
            <span className="text-sm font-medium text-[var(--success-green)]">WhatsApp</span>
          </button>
          <Button
            onClick={onViewRooms}
            className="flex-1 bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron)]/90 text-white font-semibold rounded-xl"
          >
            View Rooms →
          </Button>
        </div>
      </div>
    </div>
  );
}
