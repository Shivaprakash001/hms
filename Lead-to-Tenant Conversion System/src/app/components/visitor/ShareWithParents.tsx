import { ArrowLeft, Copy, Share2, MessageCircle } from "lucide-react";
import { Button } from "../ui/button";
import { useState } from "react";

interface ShareWithParentsProps {
  roomNumber: string;
  studentName: string;
  onBack: () => void;
}

export function ShareWithParents({ roomNumber, studentName, onBack }: ShareWithParentsProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://sriadithyahostels.in/visit/room-${roomNumber}`;
  const shareMessage = `Hi! I'm interested in Room ${roomNumber} at Sri Adithya Boys Hostel.

📍 Just 400m from SNIST
🏠 4-Sharing · ₹8,000/month
🍽️ 3 Meals daily
🔒 24/7 Security

View details: ${shareUrl}

- ${studentName}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleWhatsAppShare = () => {
    const encodedMessage = encodeURIComponent(shareMessage);
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Sri Adithya Hostel - Room ${roomNumber}`,
          text: shareMessage,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--warm-ivory)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)] sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-[var(--warm-ivory)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--brand-navy)]" />
          </button>
          <h1 className="text-xl font-bold text-[var(--brand-navy)]">Share with Parents</h1>
        </div>
      </div>

      <div className="px-6 py-8 max-w-lg mx-auto">
        {/* Preview Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 flex items-center justify-center">
              <Share2 className="w-8 h-8 text-[var(--brand-saffron)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-2">
              Share Room Details
            </h2>
            <p className="text-sm text-[var(--neutral-gray)]">
              Let your parents know about your choice
            </p>
          </div>

          {/* Message Preview */}
          <div className="bg-[var(--warm-ivory)] rounded-xl p-4 mb-4">
            <p className="text-sm text-[var(--deep-charcoal)] whitespace-pre-line font-mono">
              {shareMessage}
            </p>
          </div>
        </div>

        {/* Share Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleWhatsAppShare}
            className="w-full h-14 text-base font-semibold rounded-xl bg-[var(--success-green)] hover:bg-[var(--success-green)]/90 text-white"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Share via WhatsApp
          </Button>

          <Button
            onClick={handleCopy}
            variant="outline"
            className="w-full h-14 text-base font-semibold rounded-xl"
          >
            <Copy className="w-5 h-5 mr-2" />
            {copied ? "Copied!" : "Copy Link"}
          </Button>

          {navigator.share && (
            <Button
              onClick={handleNativeShare}
              variant="outline"
              className="w-full h-14 text-base font-semibold rounded-xl"
            >
              <Share2 className="w-5 h-5 mr-2" />
              More Share Options
            </Button>
          )}
        </div>

        {/* Info Note */}
        <div className="mt-8 p-4 bg-[var(--success-green)]/5 border border-[var(--success-green)]/20 rounded-xl">
          <p className="text-sm text-[var(--neutral-gray)] text-center">
            Your parents will see all the details about the room, facilities, location, and pricing
          </p>
        </div>
      </div>
    </div>
  );
}
