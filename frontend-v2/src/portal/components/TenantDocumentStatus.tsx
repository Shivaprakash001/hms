import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, FileWarning } from 'lucide-react';

interface Doc {
  id?: string;
  document_type?: string;
  type?: string;
  document_verified?: boolean;
  verified?: boolean;
  status?: string;
}

function docStatus(doc: Doc) {
  const verified = doc.document_verified ?? doc.verified;
  const status = String(doc.status ?? '').toUpperCase();
  if (verified === true || status === 'VERIFIED') return 'verified';
  if (status === 'PENDING' || status === 'UPLOADED') return 'pending';
  return 'missing';
}

const icon = {
  verified: CheckCircle2,
  pending: Clock,
  missing: FileWarning,
};

const label = {
  verified: 'Verified',
  pending: 'Pending',
  missing: 'Missing',
};

const tone = {
  verified: 'text-emerald-600',
  pending: 'text-amber-600',
  missing: 'text-muted-foreground',
};

export function TenantDocumentStatus({ documents }: { documents?: Doc[] | null }) {
  const docs = Array.isArray(documents) ? documents : [];

  const defaults = [
    { type: 'AADHAAR', document_type: 'AADHAAR' },
    { type: 'COLLEGE_ID', document_type: 'COLLEGE_ID' },
    { type: 'RENTAL_AGREEMENT', document_type: 'RENTAL_AGREEMENT' },
  ];

  const display =
    docs.length > 0
      ? docs.slice(0, 5)
      : defaults.map((d) => ({ ...d, status: 'MISSING' as const }));

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Documents</h2>
        <Link to="/tenant/profile#documents" className="text-xs text-accent font-medium">
          View all
        </Link>
      </div>
      <ul className="space-y-2">
        {display.map((doc, i) => {
          const st = docStatus(doc);
          const Icon = icon[st];
          const name = String(doc.document_type ?? doc.type ?? 'Document').replace(/_/g, ' ');
          return (
            <li key={doc.id ?? i} className="flex items-center justify-between text-sm">
              <span className="text-foreground capitalize">{name}</span>
              <span className={`flex items-center gap-1 text-xs font-medium ${tone[st]}`}>
                <Icon className="w-3.5 h-3.5" />
                {label[st]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
