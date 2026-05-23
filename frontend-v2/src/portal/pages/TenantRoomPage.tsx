import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Wifi } from 'lucide-react';
import { tenantService } from '@features/tenants/api';

export function TenantRoomPage() {
  const [showWifi, setShowWifi] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['tenant', 'me', 'profile'],
    queryFn: () => tenantService.getMyProfile(),
  });

  const { data: roomData, isLoading: roomLoading } = useQuery({
    queryKey: ['tenant', 'me', 'room'],
    queryFn: () => tenantService.getMyRoom(),
  });

  if (profileLoading || roomLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const allocation = (profile as Record<string, unknown>)?.room_allocations as
    | { room?: Record<string, unknown> }[]
    | undefined;
  const roomFromProfile = allocation?.[0]?.room;
  const room = (roomData?.room ?? roomFromProfile) as Record<string, unknown> | undefined;
  const roommates = (roomData?.roommates ?? []) as { name?: string }[];

  if (!room?.room_no) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-foreground">Room & hostel</h1>
        <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-6 text-center">
          <p className="font-semibold text-foreground">Room assignment pending</p>
          <p className="text-sm text-muted-foreground mt-2">
            Your hostel management team will assign you a room soon. You&apos;ll see WiFi and
            roommate details here once assigned.
          </p>
        </div>
      </div>
    );
  }

  const wifiName = room.wifi_name as string | undefined;
  const wifiPassword = room.wifi_password as string | undefined;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Room & hostel</h1>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Your room</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Room</dt>
            <dd className="font-bold text-lg">{String(room.room_no)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Floor</dt>
            <dd className="font-medium">{String(room.floor ?? room.floor_id ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Capacity</dt>
            <dd className="font-medium">{String(room.capacity ?? '—')} beds</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Roommates</dt>
            <dd className="font-medium">{roommates.length}</dd>
          </div>
        </dl>
        {roommates.length > 0 && (
          <ul className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground">
            {roommates.map((r, i) => (
              <li key={i}>{r.name}</li>
            ))}
          </ul>
        )}
      </section>

      {(wifiName || wifiPassword) && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-accent" />
            WiFi
          </h2>
          <div className="space-y-2 text-sm">
            {wifiName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium">{wifiName}</span>
              </div>
            )}
            {wifiPassword && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Password</span>
                <span className="font-medium flex items-center gap-2">
                  {showWifi ? wifiPassword : '••••••••'}
                  <button
                    type="button"
                    onClick={() => setShowWifi((v) => !v)}
                    className="p-1 text-accent"
                    aria-label={showWifi ? 'Hide password' : 'Show password'}
                  >
                    {showWifi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
