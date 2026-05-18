import { Bell, CreditCard, Lock, Shield } from 'lucide-react';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';

function SettingRow({
  icon: Icon,
  title,
  desc,
  defaultChecked = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex gap-3 min-w-0">
        <Icon className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div>
          <Label className="text-sm font-medium text-foreground">{title}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch defaultChecked={defaultChecked} disabled />
    </div>
  );
}

export function TenantSettingsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>
      <p className="text-sm text-muted-foreground">
        Preferences below will sync when your hostel enables tenant controls.
      </p>

      <section className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase pt-4 pb-1">
          Notifications
        </p>
        <SettingRow
          icon={Bell}
          title="WhatsApp rent reminders"
          desc="Get due-date alerts on WhatsApp"
          defaultChecked
        />
        <SettingRow icon={Bell} title="Push notifications" desc="In-app alerts and announcements" />
        <SettingRow icon={Bell} title="Email receipts" desc="Receive PDF receipts by email" />
      </section>

      <section className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase pt-4 pb-1">Privacy</p>
        <SettingRow
          icon={Shield}
          title="Visible to roommates"
          desc="Show name and course on room roster"
          defaultChecked
        />
        <SettingRow icon={Shield} title="Contact visibility" desc="Allow roommates to see phone" />
      </section>

      <section className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase pt-4 pb-1">Security</p>
        <SettingRow icon={Lock} title="Change password" desc="Update your login password" />
        <SettingRow icon={Lock} title="Active sessions" desc="Sign out other devices" />
      </section>

      <section className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase pt-4 pb-1">Payments</p>
        <SettingRow
          icon={CreditCard}
          title="Preferred UPI app"
          desc="Used for quick-pay shortcuts"
        />
        <SettingRow icon={CreditCard} title="Auto-pay" desc="Coming soon — pay rent automatically" />
      </section>
    </div>
  );
}
