import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ownerService } from '@features/owners/api';
import { useAuth } from '@context/AuthContext';
import { useHostelPolicy } from '@features/settings/settingsHooks';
import { queryKeys } from '@lib/queryKeys';
import {
  User, Building2, Receipt, UserCheck, CreditCard,
  Bell, Zap, Shield, LogOut, ChevronDown, ChevronRight,
} from 'lucide-react';
import { ProfileSection } from '../settings/ProfileSection';
import { HostelIdentitySection } from '../settings/HostelIdentitySection';
import { BillingSection } from '../settings/BillingSection';
import { TenantDefaultsSection } from '../settings/TenantDefaultsSection';
import { PaymentsSection } from '../settings/PaymentsSection';
import { NotificationsSection } from '../settings/NotificationsSection';
import { AutomationSection } from '../settings/AutomationSection';
import { AccessDocsSection } from '../settings/AccessDocsSection';
import { SkeletonSection } from '../settings/shared';

type SectionId = 'profile' | 'hostel' | 'billing' | 'tenant-defaults' | 'payments' | 'notifications' | 'automation' | 'access';

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType; description: string; hostelScoped: boolean }[] = [
  { id: 'profile', label: 'My Profile', icon: User, description: 'Name, phone, password', hostelScoped: false },
  { id: 'hostel', label: 'Hostel Identity', icon: Building2, description: 'Logo, name, address', hostelScoped: true },
  { id: 'billing', label: 'Rent & Billing', icon: Receipt, description: 'Cycles, due dates, late fees', hostelScoped: true },
  { id: 'tenant-defaults', label: 'Tenant Defaults', icon: UserCheck, description: 'Deposit, maintenance, invite', hostelScoped: true },
  { id: 'payments', label: 'Payments', icon: CreditCard, description: 'UPI, partial payments', hostelScoped: true },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Channels, schedule, alerts', hostelScoped: true },
  { id: 'automation', label: 'Automation', icon: Zap, description: 'Auto rent, late fees, reminders', hostelScoped: true },
  { id: 'access', label: 'Access & Receipts', icon: Shield, description: 'Permissions, receipts, regional', hostelScoped: true },
];

export function SettingsView() {
  const { logout } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>('billing');
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(null);
  const [mobileOpenSection, setMobileOpenSection] = useState<SectionId | null>('billing');

  const { data: hostelsRaw } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });
  const hostelsList: any[] = Array.isArray(hostelsRaw)
    ? hostelsRaw
    : (hostelsRaw as any)?.data?.hostels ?? (hostelsRaw as any)?.hostels ?? [];

  useEffect(() => {
    if (!selectedHostelId && hostelsList.length > 0) {
      setSelectedHostelId(hostelsList[0].id);
    }
  }, [hostelsList.length]);

  const { data: policyData, isLoading: policyLoading } = useHostelPolicy(selectedHostelId);
  const policy = policyData?.policy;
  const hostel = policyData?.hostel;

  const sectionProps = { hostelId: selectedHostelId!, policy, hostel };

  const renderSection = (id: SectionId) => {
    if (!selectedHostelId && id !== 'profile') {
      return <div className="text-sm text-muted-foreground p-4">Select a hostel above to configure settings.</div>;
    }
    if (policyLoading && id !== 'profile') return <SkeletonSection />;
    switch (id) {
      case 'profile': return <ProfileSection />;
      case 'hostel': return <HostelIdentitySection {...sectionProps} />;
      case 'billing': return <BillingSection {...sectionProps} />;
      case 'tenant-defaults': return <TenantDefaultsSection {...sectionProps} />;
      case 'payments': return <PaymentsSection {...sectionProps} />;
      case 'notifications': return <NotificationsSection {...sectionProps} />;
      case 'automation': return <AutomationSection {...sectionProps} />;
      case 'access': return <AccessDocsSection {...sectionProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Page header + hostel selector */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <h1 className="font-semibold text-foreground text-base">Settings</h1>
        {hostelsList.length > 0 && (
          <div className="relative">
            <select
              value={selectedHostelId ?? ''}
              onChange={e => setSelectedHostelId(e.target.value)}
              className="pl-3 pr-8 py-1.5 text-sm bg-secondary border border-border rounded-lg text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {hostelsList.map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* ── Desktop layout: sidebar + panel ── */}
      <div className="hidden md:flex h-[calc(100vh-53px)]">
        {/* Secondary sidebar */}
        <aside className="w-52 shrink-0 border-r border-border overflow-y-auto py-3">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors rounded-lg mx-1.5 ${
                activeSection === s.id
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <s.icon className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm truncate">{s.label}</div>
              </div>
            </button>
          ))}
          <div className="mx-3 mt-4 pt-3 border-t border-border">
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </aside>

        {/* Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-2">
            {renderSection(activeSection)}
          </div>
        </div>
      </div>

      {/* ── Mobile layout: accordion sections ── */}
      <div className="md:hidden px-4 py-4 space-y-3 pb-24">
        {SECTIONS.map(s => {
          const isOpen = mobileOpenSection === s.id;
          return (
            <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setMobileOpenSection(isOpen ? null : s.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5"
              >
                <div className={`p-1.5 rounded-lg ${isOpen ? 'bg-accent/10' : 'bg-secondary'}`}>
                  <s.icon className={`w-4 h-4 ${isOpen ? 'text-accent' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-medium ${isOpen ? 'text-accent' : 'text-foreground'}`}>{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.description}</div>
                </div>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border">
                  {renderSection(s.id)}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={logout}
          className="w-full bg-destructive/10 text-destructive p-4 rounded-xl flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Log Out</span>
        </button>

        <div className="text-center text-xs text-muted-foreground">NIVĀ Platform v1.0.0</div>
      </div>
    </div>
  );
}
