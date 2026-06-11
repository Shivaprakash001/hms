import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock3, Copy, Plus, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { useUpdateHostelPolicy, HostelPolicy } from '@features/settings/settingsHooks';
import { ownerService } from '@features/owners/api';
import { SectionShell, Toggle, FieldRow } from './shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';

interface Local {
  email: boolean; in_app: boolean; whatsapp: boolean;
  before_due_days: number[]; after_due_days: number[];
  auto_stop_after_payment: boolean;
  late_fee_notifications: boolean; owner_daily_summary: boolean;
}

const BEFORE_DUE_OPTIONS = [7, 5, 3, 2, 1];
const AFTER_DUE_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 21, 30];

const init = (p?: HostelPolicy): Local => ({
  email: p?.reminders.channels.email ?? true,
  in_app: p?.reminders.channels.in_app ?? true,
  whatsapp: p?.reminders.channels.whatsapp ?? false,
  before_due_days: p?.reminders.schedule.before_due_days ?? [],
  after_due_days: p?.reminders.schedule.after_due_days ?? [3, 7],
  auto_stop_after_payment: p?.reminders.auto_stop_after_payment ?? true,
  late_fee_notifications: p?.reminders.late_fee_notifications ?? true,
  owner_daily_summary: p?.reminders.owner_daily_summary ?? false,
});

function DayPicker({
  label, options, selected, onChange,
}: { label: string; options: number[]; selected: number[]; onChange: (v: number[]) => void }) {
  const toggle = (d: number) => onChange(
    selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d].sort((a, b) => a - b)
  );
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(d => (
          <button
            key={d}
            onClick={() => toggle(d)}
            className={`w-9 h-9 rounded-full text-xs font-medium transition-colors border ${
              selected.includes(d)
                ? 'bg-accent text-accent-foreground border-accent'
                : 'border-border text-muted-foreground hover:border-accent/50'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {label.startsWith('Before') ? 'Days before rent is due' : 'Days after rent was due'}
      </p>
    </div>
  );
}

interface Props { hostelId: string; policy?: HostelPolicy }

interface WhatsAppConnection {
  id: string;
  phone_number: string;
  verified_at?: string | null;
  created_at: string;
}

function formatPhone(phone: string) {
  const clean = String(phone || '').replace(/[^\d]/g, '');
  if (!clean) return phone || 'Unknown number';
  return clean.startsWith('91') && clean.length === 12 ? `+91 ${clean.slice(2)}` : `+${clean}`;
}

function formatConnectedAt(value?: string | null) {
  if (!value) return 'Connected time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Connected time unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatExpiresAt(value?: string | null) {
  if (!value) return 'Expires in 10 minutes';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Expires in 10 minutes';
  return `Expires ${new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)}`;
}

export function NotificationsSection({ hostelId, policy }: Props) {
  const [local, setLocal] = useState<Local>(() => init(policy));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);
  const [whatsAppLinkCode, setWhatsAppLinkCode] = useState('');
  const [linkGeneratedAt, setLinkGeneratedAt] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const mutation = useUpdateHostelPolicy(hostelId);

  useEffect(() => {
    if (!policy) return;
    const next = init(policy); setLocal(next); snap.current = next;
  }, [hostelId, policy]);

  const loadWhatsAppConnections = useCallback(async (silent = false) => {
    if (!silent) setLoadingConnections(true);
    try {
      const result = await ownerService.getWhatsAppConnections();
      const next = Array.isArray(result.connections) ? result.connections : [];
      setConnections(next);
      return next;
    } catch (err: any) {
      if (!silent) {
        toast.error(err?.response?.data?.error?.message || err?.message || 'Could not load WhatsApp connections');
      }
      return [];
    } finally {
      if (!silent) setLoadingConnections(false);
    }
  }, []);

  useEffect(() => {
    loadWhatsAppConnections();
  }, [loadWhatsAppConnections]);

  useEffect(() => {
    if (!whatsAppLinkCode || !linkGeneratedAt) return undefined;
    const generatedAtMs = new Date(linkGeneratedAt).getTime();
    const timer = window.setInterval(async () => {
      const next = await loadWhatsAppConnections(true);
      const connectedFromThisCode = next.some((connection: WhatsAppConnection) => {
        const connectedAt = new Date(connection.verified_at || connection.created_at).getTime();
        return Number.isFinite(connectedAt) && connectedAt >= generatedAtMs - 1000;
      });
      if (connectedFromThisCode) {
        setWhatsAppLinkCode('');
        setLinkGeneratedAt(null);
        setLinkExpiresAt(null);
        toast.success('WhatsApp number connected');
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [whatsAppLinkCode, linkGeneratedAt, loadWhatsAppConnections]);

  useEffect(() => {
    if (!whatsAppLinkCode || !linkExpiresAt) return undefined;
    const expiresInMs = new Date(linkExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(expiresInMs) || expiresInMs <= 0) {
      setWhatsAppLinkCode('');
      setLinkGeneratedAt(null);
      setLinkExpiresAt(null);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setWhatsAppLinkCode('');
      setLinkGeneratedAt(null);
      setLinkExpiresAt(null);
    }, expiresInMs);
    return () => window.clearTimeout(timer);
  }, [whatsAppLinkCode, linkExpiresAt]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);

  const save = () => {
    setError(null);
    mutation.mutate({
      reminders: {
        channels: { email: local.email, in_app: local.in_app, whatsapp: local.whatsapp },
        schedule: { before_due_days: local.before_due_days, after_due_days: local.after_due_days },
        auto_stop_after_payment: local.auto_stop_after_payment,
        late_fee_notifications: local.late_fee_notifications,
        owner_daily_summary: local.owner_daily_summary,
      },
    }, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = <K extends keyof Local>(k: K, v: Local[K]) => setLocal(p => ({ ...p, [k]: v }));

  const generateWhatsAppCode = async () => {
    setGeneratingCode(true);
    try {
      const result = await ownerService.generateWhatsAppLinkCode();
      setWhatsAppLinkCode(String(result.link_code || ''));
      setLinkGeneratedAt(new Date().toISOString());
      setLinkExpiresAt(result.expires_at || null);
      toast.success('WhatsApp link code generated');
      await loadWhatsAppConnections(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Could not generate WhatsApp link code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyWhatsAppLink = async () => {
    if (!whatsAppLinkCode) return;
    const text = `LINK ${whatsAppLinkCode}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Link message copied');
    } catch {
      toast.error('Could not copy link message');
    }
  };

  const disconnectWhatsApp = async (connection: WhatsAppConnection) => {
    setDisconnectingId(connection.id);
    try {
      await ownerService.disconnectWhatsAppConnection(connection.id);
      setConnections(prev => prev.filter(item => item.id !== connection.id));
      toast.success('WhatsApp connection disconnected');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Could not disconnect WhatsApp');
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <SectionShell
      title="Notifications"
      description="Configure reminder channels, schedule, and owner alerts"
      isDirty={isDirty} saving={mutation.isPending}
      onSave={save} onReset={() => { setLocal(snap.current); setError(null); }} error={error}
    >
      {/* Channels */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Channels</p>
        <FieldRow label="Email reminders" hint="Send reminder emails to tenants">
          <Toggle checked={local.email} onChange={v => upd('email', v)} />
        </FieldRow>
        <FieldRow label="In-app notifications" hint="Show alerts inside the tenant app">
          <Toggle checked={local.in_app} onChange={v => upd('in_app', v)} />
        </FieldRow>
        <FieldRow label="WhatsApp reminders" hint="Requires WhatsApp integration to be configured">
          <Toggle checked={local.whatsapp} onChange={v => upd('whatsapp', v)} />
        </FieldRow>
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Smartphone className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Owner WhatsApp assistant</p>
                {connections.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    {connections.length} active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Verified owner numbers that can use SUMMARY, DUES, and HELP.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => loadWhatsAppConnections()}
                disabled={loadingConnections}
                aria-label="Refresh WhatsApp connections"
                title="Refresh connections"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:border-accent hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loadingConnections ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={generateWhatsAppCode}
                disabled={generatingCode}
                className="h-9 inline-flex items-center gap-2 px-3 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:brightness-105 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {generatingCode ? 'Generating' : 'Add WhatsApp number'}
              </button>
            </div>
          </div>

          {connections.length > 0 ? (
            <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {connections.map(connection => (
                <div key={connection.id} className="flex flex-col gap-3 bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{formatPhone(connection.phone_number)}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Connected
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>{formatConnectedAt(connection.verified_at || connection.created_at)}</span>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        disabled={disconnectingId === connection.id}
                        className="h-8 inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-semibold text-destructive hover:border-destructive/50 disabled:opacity-60 sm:w-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {disconnectingId === connection.id ? 'Disconnecting' : 'Disconnect'}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect WhatsApp number?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {formatPhone(connection.phone_number)} will no longer receive owner assistant replies or run WhatsApp commands for this owner account.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={disconnectingId === connection.id}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={disconnectingId === connection.id}
                          onClick={() => disconnectWhatsApp(connection)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
              {loadingConnections ? 'Loading connected numbers...' : 'No owner WhatsApp numbers are connected yet.'}
            </div>
          )}

          {whatsAppLinkCode && (
            <div className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending link message</p>
                <span className="text-xs text-muted-foreground">{formatExpiresAt(linkExpiresAt)}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <code className="text-sm font-semibold text-foreground">LINK {whatsAppLinkCode}</code>
                <button
                  type="button"
                  onClick={copyWhatsAppLink}
                  className="h-8 inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:border-accent sm:w-auto"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send this from the WhatsApp number you want to connect. This panel updates after confirmation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reminder schedule */}
      <div className="border-t border-border pt-4 space-y-4">
        <DayPicker
          label="Before due date (days)"
          options={BEFORE_DUE_OPTIONS}
          selected={local.before_due_days}
          onChange={v => upd('before_due_days', v)}
        />
        <DayPicker
          label="After due date (days)"
          options={AFTER_DUE_OPTIONS}
          selected={local.after_due_days}
          onChange={v => upd('after_due_days', v)}
        />
      </div>

      {/* Behaviour */}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Behaviour</p>
        <FieldRow label="Stop reminders after payment" hint="Automatically cancel pending reminders once paid">
          <Toggle checked={local.auto_stop_after_payment} onChange={v => upd('auto_stop_after_payment', v)} />
        </FieldRow>
        <FieldRow label="Late fee applied alert" hint="Notify tenant when a late fee is added">
          <Toggle checked={local.late_fee_notifications} onChange={v => upd('late_fee_notifications', v)} />
        </FieldRow>
        <FieldRow label="Daily collection summary" hint="Owner receives a daily summary email">
          <Toggle checked={local.owner_daily_summary} onChange={v => upd('owner_daily_summary', v)} />
        </FieldRow>
      </div>
    </SectionShell>
  );
}
