import { ArrowLeft, Bed, Users, CheckCircle, Heart, Wifi, Wind, Tv } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface Roommate {
  college: string;
  year: string;
  branch: string;
}

interface RoomDetailProps {
  roomId: string;
  onBack: () => void;
  onMarkInterested: () => void;
  isInterested?: boolean;
}

export function RoomDetail({ roomId, onBack, onMarkInterested, isInterested = false }: RoomDetailProps) {
  const roommates: Roommate[] = [
    { college: "SNIST", year: "3rd Year", branch: "B.Tech CSE" },
    { college: "SNIST", year: "2nd Year", branch: "B.Tech ECE" },
    { college: "SNIST", year: "3rd Year", branch: "B.Tech MECH" },
  ];

  const facilities = [
    { icon: Wifi, label: "High-speed WiFi" },
    { icon: Wind, label: "Air Conditioning" },
    { icon: Tv, label: "Study Table & Chair" },
    { icon: Bed, label: "Comfortable Beds" },
  ];

  return (
    <div className="min-h-screen bg-[var(--warm-ivory)] pb-24">
      {/* Header with Back Button */}
      <div className="bg-white border-b border-[var(--border)] sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-[var(--warm-ivory)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--brand-navy)]" />
          </button>
          <h1 className="text-xl font-bold text-[var(--brand-navy)]">Room {roomId}</h1>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative">
        <div className="h-72 bg-gradient-to-br from-[var(--brand-navy)]/10 to-[var(--brand-saffron)]/10 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-white/90 flex items-center justify-center">
              <Bed className="w-10 h-10 text-[var(--brand-saffron)]" />
            </div>
            <p className="text-sm text-[var(--neutral-gray)]">Room interior photo</p>
          </div>
        </div>

        {/* Status Badge Overlay */}
        <div className="absolute top-4 right-4">
          <Badge className="bg-[var(--success-green)] text-white text-sm px-3 py-1">
            1 Bed Available
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 mt-6">
        {/* Price & Room Type */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-[var(--brand-saffron)]">₹8,000</span>
            <span className="text-[var(--neutral-gray)]">/month</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-[var(--neutral-gray)]">
            <div className="flex items-center gap-1">
              <Bed className="w-4 h-4" />
              <span>4 Beds</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>3 Occupied</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1 text-[var(--success-green)]">
              <CheckCircle className="w-4 h-4" />
              <span>1 Available</span>
            </div>
          </div>
        </div>

        {/* Roommate Preview */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-[var(--brand-navy)] mb-4">
            Who you'd be living with
          </h2>
          <div className="space-y-3">
            {roommates.map((roommate, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-4 flex items-center gap-4"
              >
                {/* Anonymous Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 flex items-center justify-center text-[var(--brand-navy)] font-semibold text-lg">
                  R{index + 1}
                </div>

                {/* Info */}
                <div>
                  <p className="font-medium text-[var(--deep-charcoal)]">{roommate.college}</p>
                  <p className="text-sm text-[var(--neutral-gray)]">
                    {roommate.year} · {roommate.branch}
                  </p>
                </div>
              </div>
            ))}

            {/* Empty Bed */}
            <div className="bg-[var(--success-green)]/5 border-2 border-dashed border-[var(--success-green)]/30 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--success-green)]/10 flex items-center justify-center">
                <Bed className="w-6 h-6 text-[var(--success-green)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--success-green)]">Available for you!</p>
                <p className="text-sm text-[var(--neutral-gray)]">This bed is waiting</p>
              </div>
            </div>
          </div>
        </section>

        {/* Facilities */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-[var(--brand-navy)] mb-4">Room Facilities</h2>
          <div className="bg-white rounded-xl p-4 space-y-3">
            {facilities.map((facility) => {
              const Icon = facility.icon;
              return (
                <div key={facility.label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--brand-saffron)]/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[var(--brand-saffron)]" />
                  </div>
                  <span className="text-[var(--deep-charcoal)]">{facility.label}</span>
                  <CheckCircle className="w-4 h-4 text-[var(--success-green)] ml-auto" />
                </div>
              );
            })}
          </div>
        </section>

        {/* What's Included */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-[var(--brand-navy)] mb-4">What's Included</h2>
          <div className="bg-white rounded-xl p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--success-green)]" />
                <span className="text-[var(--deep-charcoal)]">3 Meals Daily (Breakfast, Lunch, Dinner)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--success-green)]" />
                <span className="text-[var(--deep-charcoal)]">High-speed WiFi</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--success-green)]" />
                <span className="text-[var(--deep-charcoal)]">Room Maintenance & Cleaning</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--success-green)]" />
                <span className="text-[var(--deep-charcoal)]">24/7 Security</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--success-green)]" />
                <span className="text-[var(--deep-charcoal)]">Electricity & Water</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border)] p-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={onMarkInterested}
            disabled={isInterested}
            className={`w-full h-14 text-lg font-semibold rounded-xl ${
              isInterested
                ? "bg-[var(--success-green)] hover:bg-[var(--success-green)]/90"
                : "bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron)]/90"
            }`}
          >
            {isInterested ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Interested — Reserve for 24hrs
              </>
            ) : (
              <>
                <Heart className="w-5 h-5 mr-2" />
                Mark as Interested
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
