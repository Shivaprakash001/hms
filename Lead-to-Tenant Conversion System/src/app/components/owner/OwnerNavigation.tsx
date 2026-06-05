import { LayoutDashboard, Users, Bed, BarChart3, QrCode, Home } from "lucide-react";

type OwnerScreen = "dashboard" | "pipeline" | "rooms" | "analytics" | "qr-generator";

interface OwnerNavigationProps {
  currentScreen: OwnerScreen;
  onNavigate: (screen: OwnerScreen) => void;
}

export function OwnerNavigation({ currentScreen, onNavigate }: OwnerNavigationProps) {
  const navItems = [
    { id: "dashboard" as OwnerScreen, label: "Dashboard", icon: LayoutDashboard },
    { id: "pipeline" as OwnerScreen, label: "Leads", icon: Users },
    { id: "rooms" as OwnerScreen, label: "Rooms", icon: Bed },
    { id: "analytics" as OwnerScreen, label: "Analytics", icon: BarChart3 },
    { id: "qr-generator" as OwnerScreen, label: "QR Generator", icon: QrCode },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 bg-[var(--brand-navy)] text-white z-40">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-saffron)] flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ fontFamily: "var(--font-hero)" }}>
                Sri Adithya
              </h2>
              <p className="text-xs text-white/60">Owner Portal</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[var(--brand-saffron)] text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border)] z-40">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors flex-1 ${
                  isActive
                    ? "text-[var(--brand-saffron)]"
                    : "text-[var(--neutral-gray)]"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
