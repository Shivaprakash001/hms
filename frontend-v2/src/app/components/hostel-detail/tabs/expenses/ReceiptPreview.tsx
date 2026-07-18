import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Inline receipt thumbnail + full-screen lightbox — shared by the Details
// panel and the Edit modal's Receipt section. Replaces the old
// target="_blank" link-out with an in-app preview.
export function ReceiptPreview({
  url,
  variant = 'card',
  onReplace,
}: {
  url: string;
  variant?: 'card' | 'compact';
  onReplace?: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 text-left hover:bg-muted/40"
        >
          <img src={url} alt="Receipt thumbnail" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Receipt attached</p>
            <p className="text-[11px] text-muted-foreground">Tap to view full size</p>
          </div>
          {onReplace && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onReplace();
              }}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
            >
              Replace
            </span>
          )}
        </button>
        {open && <Lightbox url={url} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-border bg-muted"
      >
        <img
          src={url}
          alt="Receipt"
          className="h-40 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-transparent transition-colors group-hover:bg-black/30 group-hover:text-white">
          View full size
        </span>
      </button>
      {open && <Lightbox url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Receipt full size"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={url}
        alt="Receipt full size"
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
