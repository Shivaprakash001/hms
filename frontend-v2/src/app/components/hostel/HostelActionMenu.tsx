import { memo, useState } from 'react';
import {
  MoreVertical,
  ExternalLink,
  Pencil,
  PauseCircle,
  Archive,
  PlayCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import type { HostelStatus } from './HostelStatusBadge';

interface HostelActionMenuProps {
  hostelId: string;
  hostelName: string;
  status: HostelStatus;
  onNavigate: (hostelId: string) => void;
  onEdit: (hostelId: string) => void;
  onPause: (hostelId: string, hostelName: string) => void;
  onClose: (hostelId: string, hostelName: string) => void;
  onResume: (hostelId: string, hostelName: string) => void;
  onRestore: (hostelId: string, hostelName: string) => void;
}

function HostelActionMenuComponent({
  hostelId,
  hostelName,
  status,
  onNavigate,
  onEdit,
  onPause,
  onClose,
  onResume,
  onRestore,
}: HostelActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0 touch-manipulation"
          aria-label={`Actions for ${hostelName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
        {/* ─── ACTIVE ─── */}
        {status === 'ACTIVE' && (
          <>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(hostelId);
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Open Hostel
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(hostelId);
              }}
            >
              <Pencil className="w-4 h-4" />
              Edit Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5 py-2.5 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onPause(hostelId, hostelName);
              }}
            >
              <PauseCircle className="w-4 h-4" />
              Temporarily Close
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="gap-2.5 py-2.5 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onClose(hostelId, hostelName);
              }}
            >
              <Archive className="w-4 h-4" />
              Close Hostel
            </DropdownMenuItem>
          </>
        )}

        {/* ─── INACTIVE ─── */}
        {status === 'INACTIVE' && (
          <>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(hostelId);
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Open Hostel
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 rounded-lg text-accent"
              onClick={(e) => {
                e.stopPropagation();
                onResume(hostelId, hostelName);
              }}
            >
              <PlayCircle className="w-4 h-4" />
              Resume Operations
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2.5 py-2.5 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onClose(hostelId, hostelName);
              }}
            >
              <Archive className="w-4 h-4" />
              Close Hostel
            </DropdownMenuItem>
          </>
        )}

        {/* ─── ARCHIVED ─── */}
        {status === 'ARCHIVED' && (
          <>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(hostelId);
              }}
            >
              <FileText className="w-4 h-4" />
              View Records
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 rounded-lg text-accent"
              onClick={(e) => {
                e.stopPropagation();
                onRestore(hostelId, hostelName);
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Restore Hostel
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const HostelActionMenu = memo(HostelActionMenuComponent);
