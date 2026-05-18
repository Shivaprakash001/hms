import { Link } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';

export function TenantComplaintsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Complaints</h1>
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <MessageSquarePlus className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="font-semibold text-foreground mt-4">Complaints module coming soon</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          You&apos;ll be able to raise maintenance issues, track progress, and see resolution
          timelines here. For urgent issues, contact your hostel office directly.
        </p>
        <Link
          to="/tenant/room"
          className="inline-block mt-4 text-sm font-medium text-accent"
        >
          View hostel contact info →
        </Link>
      </div>
    </div>
  );
}
