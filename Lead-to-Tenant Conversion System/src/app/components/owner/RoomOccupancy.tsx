import { Bed, Users, UserPlus, Circle } from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { useState } from "react";

interface Room {
  id: string;
  number: string;
  block: "1" | "2";
  totalBeds: number;
  occupiedBeds: number;
  status: "available" | "almost-full" | "full" | "reserved";
  tenants: Tenant[];
  interestedLeads: string[];
}

interface Tenant {
  id: string;
  name: string;
  college: string;
  year: string;
  branch: string;
  joinedDate: string;
}

export function RoomOccupancy() {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const rooms: Room[] = [
    {
      id: "101",
      number: "101",
      block: "1",
      totalBeds: 4,
      occupiedBeds: 3,
      status: "available",
      tenants: [
        { id: "1", name: "Arjun R", college: "SNIST", year: "3rd", branch: "CSE", joinedDate: "Jan 2026" },
        { id: "2", name: "Karthik M", college: "SNIST", year: "2nd", branch: "ECE", joinedDate: "Feb 2026" },
        { id: "3", name: "Vijay K", college: "SNIST", year: "3rd", branch: "MECH", joinedDate: "Jan 2026" },
      ],
      interestedLeads: ["Rahul Kumar", "Sai Teja"],
    },
    {
      id: "102",
      number: "102",
      block: "1",
      totalBeds: 4,
      occupiedBeds: 4,
      status: "full",
      tenants: [
        { id: "4", name: "Pranav S", college: "SNIST", year: "2nd", branch: "CSE", joinedDate: "Jan 2026" },
        { id: "5", name: "Aditya S", college: "SNIST", year: "3rd", branch: "ECE", joinedDate: "Jan 2026" },
        { id: "6", name: "Rohit P", college: "SNIST", year: "2nd", branch: "IT", joinedDate: "Feb 2026" },
        { id: "7", name: "Siddharth", college: "SNIST", year: "3rd", branch: "CSE", joinedDate: "Jan 2026" },
      ],
      interestedLeads: [],
    },
    {
      id: "103",
      number: "103",
      block: "1",
      totalBeds: 4,
      occupiedBeds: 3,
      status: "reserved",
      tenants: [
        { id: "8", name: "Nikhil R", college: "SNIST", year: "2nd", branch: "MECH", joinedDate: "Feb 2026" },
        { id: "9", name: "Akhil K", college: "SNIST", year: "3rd", branch: "ECE", joinedDate: "Jan 2026" },
        { id: "10", name: "Charan T", college: "SNIST", year: "2nd", branch: "CSE", joinedDate: "Feb 2026" },
      ],
      interestedLeads: ["Pranav K (Reserved - 18h left)"],
    },
    {
      id: "201",
      number: "201",
      block: "2",
      totalBeds: 4,
      occupiedBeds: 2,
      status: "available",
      tenants: [
        { id: "11", name: "Suresh B", college: "SNIST", year: "3rd", branch: "CSE", joinedDate: "Jan 2026" },
        { id: "12", name: "Manoj K", college: "SNIST", year: "2nd", branch: "IT", joinedDate: "Feb 2026" },
      ],
      interestedLeads: ["Arun M", "Vishal S"],
    },
    {
      id: "202",
      number: "202",
      block: "2",
      totalBeds: 4,
      occupiedBeds: 1,
      status: "available",
      tenants: [
        { id: "13", name: "Rajesh T", college: "SNIST", year: "2nd", branch: "MECH", joinedDate: "Feb 2026" },
      ],
      interestedLeads: [],
    },
    {
      id: "203",
      number: "203",
      block: "2",
      totalBeds: 4,
      occupiedBeds: 3,
      status: "almost-full",
      tenants: [
        { id: "14", name: "Harish P", college: "SNIST", year: "3rd", branch: "ECE", joinedDate: "Jan 2026" },
        { id: "15", name: "Ganesh R", college: "SNIST", year: "2nd", branch: "CSE", joinedDate: "Feb 2026" },
        { id: "16", name: "Krishna M", college: "SNIST", year: "3rd", branch: "IT", joinedDate: "Jan 2026" },
      ],
      interestedLeads: ["Deepak R"],
    },
  ];

  const getStatusColor = (status: Room["status"]) => {
    switch (status) {
      case "available":
        return "var(--success-green)";
      case "almost-full":
        return "var(--alert-amber)";
      case "full":
        return "var(--danger-red)";
      case "reserved":
        return "#9333ea";
      default:
        return "var(--neutral-gray)";
    }
  };

  const getStatusLabel = (status: Room["status"]) => {
    switch (status) {
      case "available":
        return "Available";
      case "almost-full":
        return "Almost Full";
      case "full":
        return "Full";
      case "reserved":
        return "Reserved";
      default:
        return "";
    }
  };

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setIsDialogOpen(true);
  };

  const block1Rooms = rooms.filter((r) => r.block === "1");
  const block2Rooms = rooms.filter((r) => r.block === "2");

  const totalBeds = rooms.reduce((sum, r) => sum + r.totalBeds, 0);
  const occupiedBeds = rooms.reduce((sum, r) => sum + r.occupiedBeds, 0);
  const occupancyRate = Math.round((occupiedBeds / totalBeds) * 100);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <div className="bg-[var(--brand-navy)] text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">Room Occupancy</h1>
          <p className="text-white/70 text-sm">Real-time view of all rooms across both blocks</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 border-l-4 border-[var(--brand-navy)]">
            <div className="text-sm text-[var(--neutral-gray)] mb-1">Total Rooms</div>
            <div className="text-3xl font-bold text-[var(--brand-navy)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {rooms.length}
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-[var(--success-green)]">
            <div className="text-sm text-[var(--neutral-gray)] mb-1">Occupancy Rate</div>
            <div className="text-3xl font-bold text-[var(--success-green)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {occupancyRate}%
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-[var(--brand-saffron)]">
            <div className="text-sm text-[var(--neutral-gray)] mb-1">Occupied Beds</div>
            <div className="text-3xl font-bold text-[var(--brand-saffron)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {occupiedBeds}/{totalBeds}
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-[var(--alert-amber)]">
            <div className="text-sm text-[var(--neutral-gray)] mb-1">Available Beds</div>
            <div className="text-3xl font-bold text-[var(--alert-amber)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {totalBeds - occupiedBeds}
            </div>
          </Card>
        </div>

        {/* Block 1 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--brand-navy)] mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-navy)] text-white flex items-center justify-center text-sm font-bold">
              1
            </div>
            Block 1 — {block1Rooms.length} Rooms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {block1Rooms.map((room) => (
              <Card
                key={room.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleRoomClick(room)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-[var(--brand-navy)]/10 flex items-center justify-center">
                      <Bed className="w-5 h-5 text-[var(--brand-navy)]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--deep-charcoal)]">Room {room.number}</h3>
                      <p className="text-xs text-[var(--neutral-gray)]">Block 1</p>
                    </div>
                  </div>
                  <Badge
                    style={{
                      backgroundColor: getStatusColor(room.status),
                      color: "white",
                    }}
                  >
                    {getStatusLabel(room.status)}
                  </Badge>
                </div>

                {/* Bed Occupancy Visualization */}
                <div className="flex gap-2 mb-3">
                  {Array.from({ length: room.totalBeds }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-12 rounded flex items-center justify-center ${
                        i < room.occupiedBeds
                          ? "bg-[var(--brand-navy)] text-white"
                          : "bg-gray-100 text-[var(--neutral-gray)]"
                      }`}
                    >
                      <Circle className={`w-3 h-3 ${i < room.occupiedBeds ? "fill-current" : ""}`} />
                    </div>
                  ))}
                </div>

                <div className="text-sm text-[var(--neutral-gray)]">
                  <span className="font-semibold text-[var(--deep-charcoal)]">
                    {room.occupiedBeds}/{room.totalBeds}
                  </span>{" "}
                  beds occupied
                </div>

                {room.interestedLeads.length > 0 && (
                  <div className="mt-2 text-xs text-[var(--brand-saffron)]">
                    {room.interestedLeads.length} interested lead{room.interestedLeads.length > 1 ? "s" : ""}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Block 2 */}
        <div>
          <h2 className="text-xl font-semibold text-[var(--brand-navy)] mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-navy)] text-white flex items-center justify-center text-sm font-bold">
              2
            </div>
            Block 2 — {block2Rooms.length} Rooms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {block2Rooms.map((room) => (
              <Card
                key={room.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleRoomClick(room)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-[var(--brand-navy)]/10 flex items-center justify-center">
                      <Bed className="w-5 h-5 text-[var(--brand-navy)]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--deep-charcoal)]">Room {room.number}</h3>
                      <p className="text-xs text-[var(--neutral-gray)]">Block 2</p>
                    </div>
                  </div>
                  <Badge
                    style={{
                      backgroundColor: getStatusColor(room.status),
                      color: "white",
                    }}
                  >
                    {getStatusLabel(room.status)}
                  </Badge>
                </div>

                {/* Bed Occupancy Visualization */}
                <div className="flex gap-2 mb-3">
                  {Array.from({ length: room.totalBeds }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-12 rounded flex items-center justify-center ${
                        i < room.occupiedBeds
                          ? "bg-[var(--brand-navy)] text-white"
                          : "bg-gray-100 text-[var(--neutral-gray)]"
                      }`}
                    >
                      <Circle className={`w-3 h-3 ${i < room.occupiedBeds ? "fill-current" : ""}`} />
                    </div>
                  ))}
                </div>

                <div className="text-sm text-[var(--neutral-gray)]">
                  <span className="font-semibold text-[var(--deep-charcoal)]">
                    {room.occupiedBeds}/{room.totalBeds}
                  </span>{" "}
                  beds occupied
                </div>

                {room.interestedLeads.length > 0 && (
                  <div className="mt-2 text-xs text-[var(--brand-saffron)]">
                    {room.interestedLeads.length} interested lead{room.interestedLeads.length > 1 ? "s" : ""}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Room Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRoom && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[var(--brand-navy)]">
                  Room {selectedRoom.number} — Block {selectedRoom.block}
                </DialogTitle>
                <DialogDescription>
                  View room details, occupancy, current tenants, and interested leads
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Status */}
                <div>
                  <Badge
                    className="text-sm px-3 py-1"
                    style={{
                      backgroundColor: getStatusColor(selectedRoom.status),
                      color: "white",
                    }}
                  >
                    {getStatusLabel(selectedRoom.status)}
                  </Badge>
                </div>

                {/* Bed Occupancy */}
                <div>
                  <h3 className="font-semibold text-[var(--brand-navy)] mb-3">Bed Occupancy</h3>
                  <div className="flex gap-3">
                    {Array.from({ length: selectedRoom.totalBeds }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-20 rounded-lg flex items-center justify-center border-2 ${
                          i < selectedRoom.occupiedBeds
                            ? "bg-[var(--brand-navy)] border-[var(--brand-navy)] text-white"
                            : "bg-gray-50 border-gray-200 text-[var(--neutral-gray)]"
                        }`}
                      >
                        <div className="text-center">
                          <Circle className={`w-6 h-6 mx-auto mb-1 ${i < selectedRoom.occupiedBeds ? "fill-current" : ""}`} />
                          <div className="text-xs font-medium">Bed {i + 1}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Current Tenants */}
                <div>
                  <h3 className="font-semibold text-[var(--brand-navy)] mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Current Tenants ({selectedRoom.tenants.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedRoom.tenants.map((tenant) => (
                      <div key={tenant.id} className="bg-[var(--warm-ivory)] rounded-lg p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 flex items-center justify-center text-[var(--brand-navy)] font-semibold">
                          {tenant.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-[var(--deep-charcoal)]">{tenant.name}</p>
                          <p className="text-sm text-[var(--neutral-gray)]">
                            {tenant.college} · {tenant.year} · {tenant.branch}
                          </p>
                        </div>
                        <div className="text-xs text-[var(--neutral-gray)]">{tenant.joinedDate}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interested Leads */}
                {selectedRoom.interestedLeads.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-[var(--brand-navy)] mb-3 flex items-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      Interested Leads ({selectedRoom.interestedLeads.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedRoom.interestedLeads.map((lead, i) => (
                        <div key={i} className="bg-[var(--brand-saffron)]/5 border border-[var(--brand-saffron)]/20 rounded-lg p-3">
                          <p className="text-sm font-medium text-[var(--brand-saffron)]">{lead}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
