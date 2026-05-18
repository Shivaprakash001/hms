import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Check, X } from 'lucide-react';
import { tenantService } from '@features/tenants/api';
import { queryKeys } from '@lib/queryKeys';

interface Props {
  hostelId: string;
  tenantId: string;
  documents: Record<string, unknown>[];
  onUpdated?: () => void;
}

export function VerificationPanel({ hostelId, tenantId, documents, onUpdated }: Props) {
  const qc = useQueryClient();

  const verifyMutation = useMutation({
    mutationFn: (docId: string) => tenantService.verifyDocument(tenantId, docId),
    onSuccess: () => {
      toast.success('Document approved');
      qc.invalidateQueries({ queryKey: queryKeys.tenants.full(hostelId, tenantId) });
      onUpdated?.();
    },
    onError: () => toast.error('Verification API unavailable — documents are read-only until backend routes exist'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ docId, reason }: { docId: string; reason: string }) =>
      tenantService.rejectDocument(tenantId, docId, reason),
    onSuccess: () => {
      toast.success('Document rejected');
      qc.invalidateQueries({ queryKey: queryKeys.tenants.full(hostelId, tenantId) });
      onUpdated?.();
    },
    onError: () => toast.error('Rejection API unavailable'),
  });

  if (!documents?.length) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        No identification documents on file. Upload may be handled during tenant onboarding.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const id = String(doc.id ?? '');
        const status = String(doc.document_status ?? doc.status ?? 'PENDING').toUpperCase();
        return (
          <div key={id} className="p-4 rounded-xl border border-border bg-card flex gap-3">
            <FileText className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{String(doc.doc_type ?? doc.type ?? 'Document')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{status}</p>
              {doc.rejection_reason && (
                <p className="text-xs text-destructive mt-1">{String(doc.rejection_reason)}</p>
              )}
              {status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => verifyMutation.mutate(id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 text-xs font-medium"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt('Rejection reason?');
                      if (reason) rejectMutation.mutate({ docId: id, reason });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
