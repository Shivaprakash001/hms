import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { tenantService } from '@features/tenants/api';
import { TenantDocumentStatus } from '@/portal/components/TenantDocumentStatus';

export function TenantDocumentsPage() {
  const { data: documents, isLoading, isError } = useQuery({
    queryKey: ['tenant', 'me', 'documents'],
    queryFn: () => tenantService.getMyDocuments(),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Documents</h1>
      <p className="text-sm text-muted-foreground">
        Keep your ID and agreement up to date so move-in and move-out stay smooth.
      </p>
      {isError ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Document upload will be available once your hostel enables verification. Contact the
          office to submit Aadhaar, college ID, or rental agreement.
        </div>
      ) : (
        <TenantDocumentStatus documents={documents as never[]} />
      )}
      <p className="text-xs text-muted-foreground">
        To upload new documents, complete your profile or ask hostel management to send an upload
        link.
      </p>
    </div>
  );
}
