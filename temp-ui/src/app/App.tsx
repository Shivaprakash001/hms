import { useState, useEffect } from 'react';
import { BottomNav } from './components/BottomNav';
import { Onboarding } from './components/Onboarding';
import { PortfolioView } from './components/views/PortfolioView';
import { HostelsView } from './components/views/HostelsView';
import { AlertsView } from './components/views/AlertsView';
import { BillingView } from './components/views/BillingView';
import { SettingsView } from './components/views/SettingsView';

export type NavView = 'portfolio' | 'hostels' | 'alerts' | 'billing' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<NavView>('portfolio');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const onboardingComplete = localStorage.getItem('niva_onboarding_complete');
    setHasCompletedOnboarding(onboardingComplete === 'true');
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('niva_onboarding_complete', 'true');
    setHasCompletedOnboarding(true);
  };

  if (!hasCompletedOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'portfolio':
        return <PortfolioView />;
      case 'hostels':
        return <HostelsView />;
      case 'alerts':
        return <AlertsView />;
      case 'billing':
        return <BillingView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <PortfolioView />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <main className="flex-1 overflow-y-auto pb-20">
        {renderView()}
      </main>
      <BottomNav currentView={currentView} onNavigate={setCurrentView} />
    </div>
  );
}
