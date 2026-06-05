import { Users, LayoutDashboard } from "lucide-react";
import { Button } from "./ui/button";

interface ModeSelectorProps {
  currentMode: "visitor" | "owner";
  onModeChange: (mode: "visitor" | "owner") => void;
}

export function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex gap-2 bg-white rounded-xl shadow-lg p-2 border border-[var(--border)]">
      <Button
        size="sm"
        variant={currentMode === "visitor" ? "default" : "ghost"}
        onClick={() => onModeChange("visitor")}
        className={
          currentMode === "visitor"
            ? "bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron)]/90"
            : ""
        }
      >
        <Users className="w-4 h-4 mr-2" />
        Visitor
      </Button>
      <Button
        size="sm"
        variant={currentMode === "owner" ? "default" : "ghost"}
        onClick={() => onModeChange("owner")}
        className={
          currentMode === "owner"
            ? "bg-[var(--brand-navy)] hover:bg-[var(--brand-navy)]/90"
            : ""
        }
      >
        <LayoutDashboard className="w-4 h-4 mr-2" />
        Owner
      </Button>
    </div>
  );
}
