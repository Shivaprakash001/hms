import { MapPin, AlertCircle, DollarSign } from 'lucide-react';

interface Hostel {
  id: string;
  name: string;
  location: string;
  occupancy: number;
  totalRooms: number;
  occupiedRooms: number;
  revenue: string;
  pendingPayments: number;
  alerts: number;
}

interface HostelCardProps {
  hostel: Hostel;
}

export function HostelCard({ hostel }: HostelCardProps) {
  const occupancyColor = hostel.occupancy >= 90 ? 'text-[#10B981]' : hostel.occupancy >= 75 ? 'text-[#F59E0B]' : 'text-[#EF4444]';

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 active:scale-[0.98] transition-transform">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-foreground">{hostel.name}</h3>
          {hostel.alerts > 0 && (
            <span className="bg-[#EF4444] text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
              {hostel.alerts}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>{hostel.location}</span>
        </div>
      </div>

      {/* Occupancy Bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Occupancy</span>
          <span className={`text-xs font-medium ${occupancyColor}`}>{hostel.occupancy}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5">
          <div
            className="bg-accent h-1.5 rounded-full transition-all"
            style={{ width: `${hostel.occupancy}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {hostel.occupiedRooms}/{hostel.totalRooms} rooms occupied
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-accent" />
          <span className="text-sm font-medium text-foreground">{hostel.revenue}</span>
        </div>
        {hostel.pendingPayments > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-xs text-muted-foreground">{hostel.pendingPayments} pending</span>
          </div>
        )}
      </div>
    </div>
  );
}
