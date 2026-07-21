import { CalendarDays, CheckCircle2, FileText, Users } from 'lucide-react';

type Stage = {
  key: string;
  label: string;
  shortLabel: string;
  sub: string;
  value: number;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
};

export function RenewalPipelineTracker({ stages }: { stages: Stage[] }) {
  return (
    <section className="grid grid-cols-4 gap-1.5 sm:gap-3" aria-label="Renewal pipeline stages">
      {stages.map((stage) => (
        <button
          key={stage.key}
          type="button"
          onClick={stage.onClick}
          className={`rounded-lg border p-2 text-center shadow-sm transition-all focus:outline-none sm:rounded-xl sm:p-4 sm:text-left ${
            stage.active
              ? 'border-accent bg-accent/5 ring-1 ring-accent'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="hidden items-center justify-between gap-2 sm:flex">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{stage.label}</span>
            {stage.icon}
          </div>
          <p className="text-lg font-extrabold tabular-nums text-foreground sm:mt-2 sm:text-2xl sm:font-bold">{stage.value}</p>
          <p className="text-[9px] font-bold uppercase leading-tight text-muted-foreground sm:hidden">{stage.shortLabel}</p>
          <p className="mt-1 hidden text-[10px] text-muted-foreground sm:block">{stage.sub}</p>
        </button>
      ))}
    </section>
  );
}

export const pipelineIcons = {
  expiring: <CalendarDays className="h-4 w-4 text-amber-500" />,
  draft: <FileText className="h-4 w-4 text-blue-500" />,
  negotiating: <Users className="h-4 w-4 text-amber-600" />,
  renewed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
};
