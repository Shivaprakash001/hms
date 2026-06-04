import { ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';

// ─── SectionShell ─────────────────────────────────────────────────────────────

interface SectionShellProps {
  title: string;
  description?: string;
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  children: ReactNode;
  error?: string | null;
}

export function SectionShell({ title, description, isDirty, saving, onSave, onReset, children, error }: SectionShellProps) {
  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {isDirty && (
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-secondary transition-colors">
                Reset
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-4 px-3 py-2.5 bg-destructive/10 text-destructive text-xs rounded-lg">{error}</div>
        )}

        <div className="px-5 py-5 space-y-5">{children}</div>
      </div>

      {isDirty && (
        <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-foreground border border-border shadow-2xl px-5 py-3 rounded-full animate-in fade-in slide-in-from-bottom-6 duration-300">
          <span className="text-sm font-medium text-background hidden sm:block whitespace-nowrap">Unsaved changes</span>
          <div className="w-px h-5 bg-background/20 hidden sm:block" />
          <button onClick={onReset} className="text-sm font-medium text-background/70 hover:text-background transition-colors px-1 whitespace-nowrap">
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="text-sm bg-accent text-accent-foreground px-5 py-2 rounded-full font-semibold shadow-md hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className="w-10 h-6 bg-border rounded-full data-[state=checked]:bg-accent transition-colors disabled:opacity-40 outline-none shrink-0"
    >
      <Switch.Thumb className="block w-4 h-4 bg-white rounded-full translate-x-1 data-[state=checked]:translate-x-5 transition-transform shadow" />
    </Switch.Root>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

export function FieldRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Field (labelled input wrapper) ──────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Inp (styled input) ───────────────────────────────────────────────────────

export const inp = 'w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted-foreground';

// ─── Select ───────────────────────────────────────────────────────────────────

export function Sel({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={inp}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── SkeletonBlock ────────────────────────────────────────────────────────────

export function SkeletonSection() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-border">
        <div className="h-4 w-32 bg-secondary rounded" />
      </div>
      <div className="px-5 py-5 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-20 bg-secondary rounded" />
            <div className="h-10 bg-secondary rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
