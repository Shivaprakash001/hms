import { useState } from 'react';
import { User, Bell, Lock, CreditCard, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
import { PricingRatesModal } from '../modals/PricingRatesModal';

const settingsGroups = [
  {
    title: 'Account',
    items: [
      { icon: User, label: 'Profile', description: 'Manage your account details' },
      { icon: Bell, label: 'Notifications', description: 'Configure alert preferences' },
      { icon: Lock, label: 'Security', description: 'Password and authentication' },
    ],
  },
  {
    title: 'Business Settings',
    items: [
      { icon: CreditCard, label: 'Pricing & Rates', description: 'Set accommodation prices and overdue policies' },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: HelpCircle, label: 'Help & Support', description: 'Get help or contact us' },
    ],
  },
];

export function SettingsView() {
  const [showPricingRates, setShowPricingRates] = useState(false);

  const handleItemClick = (label: string) => {
    if (label === 'Pricing & Rates') {
      setShowPricingRates(true);
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
        <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center">
          <span className="text-xl font-semibold text-accent-foreground">SK</span>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-foreground">Sanjay Kumar</div>
          <div className="text-sm text-muted-foreground mt-0.5">sanjay@niva.co</div>
          <div className="text-xs text-muted-foreground mt-1">Owner • 4 Properties</div>
        </div>
      </div>

      {/* Settings Groups */}
      {settingsGroups.map((group) => (
        <div key={group.title}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {group.title}
          </h3>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {group.items.map((item) => (
              <button
                key={item.label}
                onClick={() => handleItemClick(item.label)}
                className="w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors first:rounded-t-xl last:rounded-b-xl active:scale-[0.99]"
              >
                <div className="p-2 bg-secondary rounded-lg">
                  <item.icon className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <button className="w-full bg-destructive/10 text-destructive p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Log Out</span>
      </button>

      {/* Version */}
      <div className="text-center text-xs text-muted-foreground">
        Sri Adithya Platform v1.0.0
      </div>

      {/* Modals */}
      {showPricingRates && (
        <PricingRatesModal
          onClose={() => setShowPricingRates(false)}
          onSave={(data) => {
            console.log('Save pricing:', data);
            setShowPricingRates(false);
          }}
        />
      )}
    </div>
  );
}
