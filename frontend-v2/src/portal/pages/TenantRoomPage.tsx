import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Eye, 
  EyeOff, 
  Loader2, 
  Wifi, 
  Copy, 
  Check, 
  Users, 
  Building, 
  Phone, 
  MapPin, 
  Clock, 
  Layers,
  Sparkles,
  UserCheck,
  AlertCircle,
  BedDouble
} from 'lucide-react';
import { tenantService } from '@features/tenants/api';

export function TenantRoomPage() {
  const [showWifi, setShowWifi] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['tenant', 'me', 'profile'],
    queryFn: () => tenantService.getMyProfile(),
  });

  const { data: roomData, isLoading: roomLoading } = useQuery({
    queryKey: ['tenant', 'me', 'room'],
    queryFn: () => tenantService.getMyRoom(),
  });

  const handleCopyWifi = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy WiFi password:', err);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarBg = (name: string) => {
    const colors = [
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  if (profileLoading || roomLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#243A72] mx-auto" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading room details...</p>
        </div>
      </div>
    );
  }

  // Fallbacks: check both endpoints
  const resStatus = profile?.reservation_status?.status ?? 'PAYMENT_PENDING';
  const profileRoom = profile?.room;
  const room = (roomData?.room ?? profileRoom) as Record<string, any> | undefined;
  const roommates = (roomData?.roommates ?? []) as { name?: string }[];
  const hostel = profile?.hostel;
  const ownerContact = profile?.owner_contact;

  if (!room?.room_no) {
    return (
      <div className="space-y-6 max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Room & Hostel</h1>
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-500/[0.02] p-8 text-center shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16 animate-pulse"></div>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-6">
            <Building className="w-8 h-8 animate-bounce" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Room Assignment Pending</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Your hostel management team will assign you a room soon. Once assigned, your room details, roommate list, and WiFi credentials will be available here.
          </p>
          <div className="mt-8 pt-6 border-t border-border/60 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
            <span>Sri Adithya Boys Hostel welcomes you!</span>
          </div>
        </div>
      </div>
    );
  }

  const wifiName = room.wifi_name as string | undefined;
  const wifiPassword = room.wifi_password as string | undefined;
  
  // Occupancy calculations
  const capacity = Number(room.capacity || 1);
  const occupiedCount = roommates.length + 1;
  const vacantCount = Math.max(0, capacity - occupiedCount);

  // Hostel Address formatting
  const hostelName = hostel?.name ?? 'Sri Adithya Boys Hostel';
  const fullAddress = hostel?.address 
    ? `${hostel.address}, ${hostel.city ?? ''}, ${hostel.state ?? ''} ${hostel.pincode ?? ''}`
    : 'Hyderabad, Telangana';

  // Contact shortcut
  const managerPhone = ownerContact?.owner_phone ?? hostel?.phone;
  const managerName = ownerContact?.manager_name ?? ownerContact?.owner_name ?? 'Hostel Manager';

  return (
    <div className="space-y-6 max-w-md mx-auto px-4 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Room & Hostel</h1>
        {resStatus === 'PAYMENT_PENDING' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Payment Pending
          </span>
        ) : resStatus === 'RESERVED' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <BedDouble className="w-3.5 h-3.5" />
            Reserved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <UserCheck className="w-3.5 h-3.5" />
            Move-in Ready
          </span>
        )}
      </div>

      {/* Hero Smart Card */}
      <section 
        className="relative overflow-hidden rounded-2xl text-white p-6 shadow-lg shadow-blue-950/15"
        style={{ background: 'linear-gradient(135deg, #1B2D5B 0%, #243A72 100%)' }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/15 rounded-full blur-xl -ml-16 -mb-16"></div>

        <div className="relative flex justify-between items-start">
          <div>
            <span className="text-xs uppercase tracking-wider text-blue-100 font-semibold">
              {resStatus === 'PAYMENT_PENDING' ? 'Pending Assignment' : resStatus === 'RESERVED' ? 'Reserved' : 'Active Assignment'}
            </span>
            <h2 className="text-4xl font-extrabold mt-1 tracking-tight">Room {String(room.room_no)}</h2>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-xs font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>{String(room.floor ?? room.floor_id ?? 'G')} Floor</span>
          </div>
        </div>

        {/* Dynamic Bed Occupancy Visualizer */}
        {resStatus !== 'PAYMENT_PENDING' && (
          <div className="mt-8 relative z-10">
            <div className="text-xs text-blue-100/90 font-medium mb-3 flex justify-between items-center">
              <span>Beds Occupancy Grid</span>
              <span>{occupiedCount} of {capacity} Occupied</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: capacity }).map((_, idx) => {
                const isMe = idx === 0;
                const isOccupied = idx < occupiedCount;
                return (
                  <div 
                    key={idx}
                    className={`h-10 rounded-lg flex flex-col items-center justify-center text-[10px] font-semibold border transition-all ${
                      isMe 
                        ? 'bg-white text-[#243A72] border-white shadow-md'
                        : isOccupied 
                          ? 'bg-white/25 border-white/20 text-white' 
                          : 'border-white/30 border-dashed bg-transparent text-white/50'
                    }`}
                  >
                    <span className="leading-tight">{isMe ? 'You' : isOccupied ? 'Occupied' : 'Vacant'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Roommates Card */}
      {resStatus !== 'PAYMENT_PENDING' && (
        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-[#243A72]" />
              Roommates ({roommates.length})
            </h3>
            {vacantCount > 0 && (
              <span className="text-xs font-medium text-[#243A72] bg-[#243A72]/5 px-2 py-0.5 rounded-md">
                {vacantCount} vacant bed{vacantCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="divide-y divide-border/60">
            {/* Main User Row */}
            <div className="flex items-center gap-3 pb-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border bg-[#243A72]/10 text-[#243A72] border-[#243A72]/20">
                ME
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">You</p>
                <p className="text-xs text-[#243A72] font-medium">Bed A (Primary)</p>
              </div>
            </div>

            {/* Other Roommates Rows */}
            {roommates.map((r, i) => {
              const name = String(r.name ?? 'Occupied Bed');
              const initials = name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'RM';
              const isLast = i === roommates.length - 1 && vacantCount === 0;
              return (
                <div key={i} className={`flex items-center gap-3 py-3 ${isLast ? 'pb-0' : ''}`}>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">Roommate</p>
                  </div>
                </div>
              );
            })}

            {/* Vacant Beds Placeholders */}
            {Array.from({ length: vacantCount }).map((_, i) => {
              const isLast = i === vacantCount - 1;
              return (
                <div key={`vacant-${i}`} className={`flex items-center gap-3 py-3 border-dashed ${isLast ? 'pb-0' : ''}`}>
                  <div className="h-10 w-10 rounded-full flex items-center justify-center border border-dashed border-border/80 text-muted-foreground/40 bg-muted/20">
                    +
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground/60">Vacant Bed</p>
                    <p className="text-xs text-muted-foreground/40">Available for assignment</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* WiFi Credentials Card */}
      {(wifiName || wifiPassword) && (
        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl -mr-8 -mt-8"></div>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Room WiFi</h3>
              <p className="text-xs text-muted-foreground">High-speed internet access</p>
            </div>
          </div>

          <div className="space-y-3 bg-muted/30 rounded-xl p-3.5 border border-border/40 text-sm">
            {wifiName && (
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-muted-foreground font-medium">Network SSID</span>
                <span className="font-semibold text-foreground">{wifiName}</span>
              </div>
            )}
            {wifiPassword && (
              <div className="flex justify-between items-center py-1 border-t border-border/40 pt-2.5">
                <span className="text-xs text-muted-foreground font-medium">Password</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground tracking-wide bg-background px-2.5 py-0.5 rounded border border-border/60 text-xs">
                    {showWifi ? wifiPassword : '••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowWifi((v) => !v)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={showWifi ? 'Hide password' : 'Show password'}
                  >
                    {showWifi ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {wifiPassword && (
            <button
              type="button"
              onClick={() => handleCopyWifi(wifiPassword)}
              className={`w-full mt-3.5 py-2 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                copied 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-foreground hover:bg-foreground/90 text-background border-transparent'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Password Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Password</span>
                </>
              )}
            </button>
          )}
        </section>
      )}

      {/* Hostel & Management Info Card */}
      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Building className="w-4 h-4 text-[#243A72]" />
          Hostel Details
        </h3>

        <div className="space-y-3.5">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">{hostelName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{fullAddress}</p>
            </div>
          </div>

          {hostel?.office_hours && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Office Hours: {hostel.office_hours}</span>
            </div>
          )}

          {managerPhone && (
            <div className="pt-3 border-t border-border/60">
              <div className="bg-blue-500/[0.02] border border-blue-500/10 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Need Assistance?</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{managerName}</p>
                </div>
                <a
                  href={`tel:${managerPhone}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#243A72] text-white shadow-sm shadow-blue-500/10 hover:bg-[#1B2D5B] transition-colors"
                  aria-label={`Call ${managerName}`}
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
