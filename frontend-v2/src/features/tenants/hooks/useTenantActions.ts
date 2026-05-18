import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantService } from '@features/tenants/api';
import { queryKeys } from '@lib/queryKeys';

export function useTenantActions(hostelId: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
  };

  const updateInvite = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      tenantService.update(id, { invitation_edit: true, ...data }),
    onSuccess: () => {
      toast.success('Invitation updated');
      invalidate();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to update invitation'),
  });

  const cancelInvite = useMutation({
    mutationFn: (id: string) => tenantService.cancelInvitation(id),
    onSuccess: () => {
      toast.success('Invitation cancelled');
      invalidate();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to cancel'),
  });

  const resendInvite = useMutation({
    mutationFn: (email: string) => tenantService.resendInvitation(email),
    onSuccess: () => toast.success('Invitation resent'),
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to resend'),
  });

  const reactivate = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      tenantService.reactivate(id, data ?? {}),
    onSuccess: () => {
      toast.success('Tenant reactivated');
      invalidate();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to reactivate'),
  });

  const markLeft = useMutation({
    mutationFn: (id: string) => tenantService.delete(id),
    onSuccess: () => {
      toast.success('Tenant marked as LEFT');
      invalidate();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Cannot remove tenant'),
  });

  const blockDirectLeft = () => {
    toast.error('Use the Move-Out workflow to process departures and settlements.');
  };

  const callTenant = async (phone: string) => {
    if (!phone || phone === 'N/A') {
      toast.error('Phone number unavailable');
      return;
    }
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      /* ignore */
    }
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) window.open(`tel:${phone}`, '_self');
    else toast.success('Phone copied to clipboard');
  };

  return {
    updateInvite,
    cancelInvite,
    resendInvite,
    reactivate,
    markLeft,
    blockDirectLeft,
    callTenant,
  };
}
