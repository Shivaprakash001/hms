import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FileText, MessageSquare, MoreHorizontal, Settings, User } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet';

const moreLinks = [
  { to: '/tenant/documents', icon: FileText, label: 'Documents' },
  { to: '/tenant/complaints', icon: MessageSquare, label: 'Complaints' },
  { to: '/tenant/profile', icon: User, label: 'Profile' },
  { to: '/tenant/settings', icon: Settings, label: 'Settings' },
];

export function TenantMoreNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 px-2 min-w-[56px] text-[10px] font-medium text-muted-foreground touch-manipulation"
        >
          <MoreHorizontal className="w-5 h-5" />
          More
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader>
          <SheetTitle className="text-left">More</SheetTitle>
        </SheetHeader>
        <nav className="grid grid-cols-2 gap-2 mt-4">
          {moreLinks.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card"
            >
              <Icon className="w-5 h-5 text-accent" />
              <span className="font-medium text-sm">{label}</span>
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function TenantMoreNavActiveCheck({ pathname }: { pathname: string }) {
  const morePaths = moreLinks.map((l) => l.to);
  return morePaths.some((p) => pathname.startsWith(p));
}
