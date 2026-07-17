import type { FinancialSectionId } from '@features/tenants/components/financial/CompactFinancialStrip';

const SECTIONS: { id: FinancialSectionId; label: string }[] = [
  { id: 'fin-summary', label: 'Summary' },
  { id: 'fin-actions', label: 'Actions' },
  { id: 'fin-obligations', label: 'Obligations' },
  { id: 'fin-activity', label: 'Activity' },
  { id: 'fin-ledger', label: 'Ledger' },
  { id: 'fin-documents', label: 'Documents' },
];

interface FinancialWorkspaceNavProps {
  onNavigate: (section: FinancialSectionId) => void;
}

export function FinancialWorkspaceNav({ onNavigate }: FinancialWorkspaceNavProps) {
  return (
    <div className="hidden md:flex sticky top-0 z-20 gap-1 bg-background/95 backdrop-blur-sm border-b border-border py-2 -mx-4 px-4">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onNavigate(section.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}
