import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X } from "lucide-react";

interface QuickRegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { studentName: string; studentMobile: string; parentMobile?: string }) => void;
}

export function QuickRegistration({ isOpen, onClose, onComplete }: QuickRegistrationProps) {
  const [studentName, setStudentName] = useState("");
  const [studentMobile, setStudentMobile] = useState("");
  const [parentMobile, setParentMobile] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentName.trim() && studentMobile.trim()) {
      onComplete({
        studentName,
        studentMobile,
        parentMobile: parentMobile.trim() || undefined,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      ></div>

      {/* Bottom Sheet */}
      <div className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--neutral-gray)] hover:text-[var(--deep-charcoal)] transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <p className="text-[var(--neutral-gray)] text-sm mb-2">
            Just your name and number — that's it.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Student Name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="h-14 rounded-2xl text-base px-4 bg-[var(--warm-ivory)] border-none focus-visible:ring-2 focus-visible:ring-[var(--brand-saffron)]"
              required
            />
          </div>

          <div>
            <Input
              type="tel"
              placeholder="Student Mobile"
              value={studentMobile}
              onChange={(e) => setStudentMobile(e.target.value)}
              className="h-14 rounded-2xl text-base px-4 bg-[var(--warm-ivory)] border-none focus-visible:ring-2 focus-visible:ring-[var(--brand-saffron)]"
              pattern="[0-9]{10}"
              required
            />
          </div>

          <div>
            <label className="text-sm text-[var(--neutral-gray)] mb-2 block">
              Optional — for sharing details with family
            </label>
            <Input
              type="tel"
              placeholder="Parent Mobile"
              value={parentMobile}
              onChange={(e) => setParentMobile(e.target.value)}
              className="h-14 rounded-2xl text-base px-4 bg-[var(--warm-ivory)] border-none focus-visible:ring-2 focus-visible:ring-[var(--brand-saffron)]"
              pattern="[0-9]{10}"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron)]/90 text-white rounded-2xl mt-6"
          >
            Continue →
          </Button>

          <p className="text-center text-sm text-[var(--neutral-gray)] mt-4">
            No spam. No account. No password.
          </p>
        </form>
      </div>
    </div>
  );
}
