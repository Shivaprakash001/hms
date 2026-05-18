import React, { useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, RefreshCw } from 'lucide-react';
import { reminderService } from '@/api/services';
import { apiErrorCode } from '../utils/defaulterHelpers';

export function ReminderButton({ tenantId, onNoCredits }) {
  const [status, setStatus] = useState('idle');

  const tap = async () => {
    if (status !== 'idle') return;
    setStatus('sending');
    try {
      const res = await reminderService.sendToTenant(tenantId);
      if (!res?.success) {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setStatus('sent');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (err) {
      if (apiErrorCode(err) === 'NO_REMINDERS_LEFT') onNoCredits?.();
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const variants = {
    idle: { bg: 'bg-secondary', text: 'text-muted-foreground', Icon: Bell },
    sending: { bg: 'bg-ops-accent/10', text: 'text-ops-accent', Icon: RefreshCw },
    sent: { bg: 'bg-ops-success/10', text: 'text-ops-success', Icon: CheckCircle2 },
    error: { bg: 'bg-ops-danger/10', text: 'text-ops-danger', Icon: AlertTriangle },
  };
  const { bg, text, Icon } = variants[status];

  return (
    <button
      type="button"
      onClick={tap}
      className={`shrink-0 p-2.5 rounded-lg transition-all active:scale-95 ${bg} ${text}`}
      aria-label="Send payment reminder"
    >
      <Icon size={16} className={status === 'sending' ? 'animate-spin' : ''} />
    </button>
  );
}
