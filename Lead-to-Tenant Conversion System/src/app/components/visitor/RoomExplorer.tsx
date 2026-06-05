import { useState } from "react";
import { Bed, Users, CheckCircle, Heart } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface Room {
  id: string;
  number: string;
  totalBeds: number;
  occupied: number;
  available: number;
  price: number;
  status: "available" | "reserved" | "full";
  amenities: string[];
}

interface RoomExplorerProps {
  onViewDetails: (roomId: string) => void;
  onInterest: (roomId: string) => void;
}

export function RoomExplorer({ onViewDetails, onInterest }: RoomExplorerProps) {
  const [filter, setFilter] = useState<"all" | "available" | "4-sharing">("all");
  const [interestedRooms, setInterestedRooms] = useState<Set<string>>(new Set());

  const rooms: Room[] = [
    {
      id: "101",
      number: "101",
      totalBeds: 4,
      occupied: 3,
      available: 1,
      price: 8000,
      status: "available",
      amenities: ["Maintenance", "Meals", "WiFi"],
    },
    {
      id: "102",
      number: "102",
      totalBeds: 4,
      occupied: 4,
      available: 0,
      price: 8000,
      status: "full",
      amenities: ["Maintenance", "Meals", "WiFi"],
    },
    {
      id: "103",
      number: "103",
      totalBeds: 4,
      occupied: 3,
      available: 1,
      price: 8000,
      status: "reserved",
      amenities: ["Maintenance", "Meals", "WiFi"],
    },
    {
      id: "201",
      number: "201",
      totalBeds: 4,
      occupied: 2,
      available: 2,
      price: 8000,
      status: "available",
      amenities: ["Maintenance", "Meals", "WiFi", "AC"],
    },
    {
      id: "202",
      number: "202",
      totalBeds: 4,
      occupied: 1,
      available: 3,
      price: 8000,
      status: "available",
      amenities: ["Maintenance", "Meals", "WiFi"],
    },
    {
      id: "203",
      number: "203",
      totalBeds: 4,
      occupied: 3,
      available: 1,
      price: 8000,
      status: "available",
      amenities: ["Maintenance", "Meals", "WiFi"],
    },
  ];

  const filteredRooms = rooms.filter((room) => {
    if (filter === "all") return true;
    if (filter === "available") return room.status === "available";
    if (filter === "4-sharing") return room.totalBeds === 4;
    return true;
  });

  const handleInterest = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setInterestedRooms((prev) => {
      const newSet = new Set(prev);
      newSet.add(roomId);
      return newSet;
    });
    onInterest(roomId);
  };

  const getStatusBadge = (status: Room["status"], available: number) => {
    if (status === "available") {
      return (
        <Badge className="bg-[var(--success-green)] text-white hover:bg-[var(--success-green)]/90">
          {available} Bed{available > 1 ? "s" : ""} Available
        </Badge>
      );
    }
    if (status === "reserved") {
      return (
        <Badge className="bg-[var(--alert-amber)] text-white hover:bg-[var(--alert-amber)]/90">
          Reserved
        </Badge>
      );
    }
    return (
      <Badge className="bg-[var(--danger-red)] text-white hover:bg-[var(--danger-red)]/90">
        Full
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--warm-ivory)] pb-6">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)] sticky top-0 z-10">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-[var(--brand-navy)] mb-4">Available Rooms</h1>

          {/* Filter Bar */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === "all"
                  ? "bg-[var(--brand-saffron)] text-white"
                  : "bg-[var(--warm-ivory)] text-[var(--deep-charcoal)] hover:bg-[var(--brand-saffron)]/10"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("available")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === "available"
                  ? "bg-[var(--brand-saffron)] text-white"
                  : "bg-[var(--warm-ivory)] text-[var(--deep-charcoal)] hover:bg-[var(--brand-saffron)]/10"
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setFilter("4-sharing")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === "4-sharing"
                  ? "bg-[var(--brand-saffron)] text-white"
                  : "bg-[var(--warm-ivory)] text-[var(--deep-charcoal)] hover:bg-[var(--brand-saffron)]/10"
              }`}
            >
              4-Sharing
            </button>
          </div>
        </div>
      </div>

      {/* Room Cards */}
      <div className="px-6 mt-4 space-y-4">
        {filteredRooms.map((room) => (
          <div
            key={room.id}
            className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Room Header */}
            <div className="relative">
              {/* Room Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-[var(--brand-navy)]/10 to-[var(--brand-saffron)]/10 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-xl bg-white/80 flex items-center justify-center">
                    <Bed className="w-8 h-8 text-[var(--brand-saffron)]" />
                  </div>
                  <p className="text-sm text-[var(--neutral-gray)]">Room photo</p>
                </div>
              </div>

              {/* Room Number Badge */}
              <div className="absolute top-3 left-3 px-3 py-1 bg-[var(--brand-navy)] text-white rounded-lg font-semibold">
                Room {room.number}
              </div>

              {/* Status Badge */}
              <div className="absolute top-3 right-3">
                {getStatusBadge(room.status, room.available)}
              </div>
            </div>

            {/* Room Details */}
            <div className="p-4">
              {/* Stats */}
              <div className="flex items-center gap-4 mb-3 text-sm text-[var(--neutral-gray)]">
                <div className="flex items-center gap-1">
                  <Bed className="w-4 h-4" />
                  <span>{room.totalBeds} Beds</span>
                </div>
                <span>·</span>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{room.occupied} Occupied</span>
                </div>
                <span>·</span>
                <div className="flex items-center gap-1 text-[var(--success-green)]">
                  <CheckCircle className="w-4 h-4" />
                  <span>{room.available} Available</span>
                </div>
              </div>

              {/* Price */}
              <div className="mb-3">
                <span className="text-2xl font-bold text-[var(--brand-saffron)]">
                  ₹{room.price.toLocaleString()}
                </span>
                <span className="text-[var(--neutral-gray)]">/month</span>
              </div>

              {/* Amenities */}
              <div className="flex items-center gap-2 mb-4 text-xs text-[var(--neutral-gray)]">
                {room.amenities.map((amenity) => (
                  <span key={amenity} className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-[var(--success-green)]" />
                    {amenity}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onViewDetails(room.id)}
                  className="flex-1 rounded-xl"
                >
                  View Details
                </Button>
                <Button
                  onClick={(e) => handleInterest(room.id, e)}
                  disabled={room.status === "full" || interestedRooms.has(room.id)}
                  className={`flex-1 rounded-xl font-semibold ${
                    interestedRooms.has(room.id)
                      ? "bg-[var(--success-green)] hover:bg-[var(--success-green)]/90"
                      : "bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron)]/90"
                  }`}
                >
                  {interestedRooms.has(room.id) ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Interested
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4 mr-1" />
                      I'm Interested
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
