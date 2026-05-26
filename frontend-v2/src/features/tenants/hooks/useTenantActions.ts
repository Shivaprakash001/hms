import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hmsToast } from '@lib/toast';
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
    onError: (e: unknown) => hmsToast.error(e, 'Update invitation'),
  });

  const cancelInvite = useMutation({
    mutationFn: (id: string) => tenantService.cancelInvitation(id),
    onSuccess: () => {
      toast.success('Invitation cancelled');
      invalidate();
    },
    onError: (e: unknown) => hmsToast.error(e, 'Cancel invitation'),
  });

  const resendInvite = useMutation({
    mutationFn: (email: string) => tenantService.resendInvitation(email),
    onSuccess: () => {
      toast.success('Invitation resent');
      invalidate();
    },
    onError: (e: unknown) => hmsToast.error(e, 'Resend invitation'),
  });

  const reactivate = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      tenantService.reactivate(id, data ?? {}),
    onSuccess: () => {
      toast.success('Tenant reactivated');
      invalidate();
    },
    onError: (e: unknown) => hmsToast.error(e, 'Reactivate tenant'),
  });

  const markLeft = useMutation({
    mutationFn: (id: string) => tenantService.delete(id),
    onSuccess: () => {
      toast.success('Tenant marked as LEFT');
      invalidate();
    },
    onError: (e: unknown) => hmsToast.error(e, 'Mark tenant as left'),
  });

  const blockDirectLeft = () => {
    hmsToast.warning(
      'Use the Move-Out workflow',
      'Departures must go through the Move-Out process to settle dues and deposit correctly.',
    );
  };

  const callTenant = async (phone: string) => {
    if (!phone || phone === 'N/A') {
      hmsToast.warning('Phone number unavailable', 'No phone number is saved for this tenant.');
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
