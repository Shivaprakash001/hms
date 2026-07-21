import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';
import { paymentService } from '@features/payments/api';

const fmt = (n: unknown) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
};

/**
 * Cross-hostel tenant/room/phone search, shown inline as a dropdown under the
 * input — no navigation happens until the owner picks a specific result.
 * Reuses the existing owner-scoped (all hostels) quick-collect search rather
 * than a new endpoint, since it already matches name/phone/room_no and
 * returns hostel_id/hostel_name/room_no per result (see RecordPaymentModal.tsx
 * for the same query used in a payment-collection context).
 */
export function UniversalSearchBar() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(handler);
  }, [query]);

  const trimmed = debouncedQuery.trim();
  const { data: results, isLoading } = useQuery({
    queryKey: ['payments', 'quick-collect', 'search', trimmed],
    queryFn: () => paymentService.quickCollectSearch(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 5000,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const showDropdown = isOpen && query.trim().length >= 2;
  const rows = Array.isArray(results) ? results : [];

  const handleSelect = (tenant: any) => {
    setQuery('');
    setIsOpen(false);
    navigate(`/hostels/${tenant.hostel_id}/tenants/${tenant.id}`);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search tenant, room, phone…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-9 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setDebouncedQuery('');
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border bg-card shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching across all hostels…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tenants, rooms, or phone numbers match "{query}"
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((t: any) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold text-primary">
                      {String(t.name || '?').split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.hostel_name} · Room {t.room_no || 'N/A'} {t.phone ? `· ${t.phone}` : ''}
                      </p>
                    </div>
                  </div>
                  {Number(t.outstanding_dues) > 0 && (
                    <span className="shrink-0 text-xs font-bold text-destructive">{fmt(t.outstanding_dues)} due</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
