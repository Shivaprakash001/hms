import { CheckCircle, Share2, MessageCircle } from "lucide-react";
import { Button } from "../ui/button";
import { motion } from "motion/react";

interface InterestConfirmationProps {
  roomNumber: string;
  studentName: string;
  onExploreMore: () => void;
  onShare: () => void;
}

export function InterestConfirmation({
  roomNumber,
  studentName,
  onExploreMore,
  onShare,
}: InterestConfirmationProps) {
  const handleWhatsApp = () => {
    window.open("https://wa.me/919876543210", "_blank");
  };

  return (
    <div className="min-h-screen bg-[var(--warm-ivory)] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Animated Checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="flex justify-center mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-[var(--brand-saffron)] flex items-center justify-center">
            <CheckCircle className="w-14 h-14 text-white" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Success Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1
            className="text-3xl font-bold text-[var(--brand-navy)] mb-3"
            style={{ fontFamily: 'var(--font-hero)' }}
          >
            Great choice, {studentName}!
          </h1>
          <p className="text-[var(--neutral-gray)] text-lg">
            We've noted your interest in <span className="font-semibold text-[var(--deep-charcoal)]">Room {roomNumber}</span>.
            Srinivasa Rao will reach out to you shortly.
          </p>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white rounded-2xl p-6 mb-6 border border-[var(--brand-saffron)]/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--success-green)]/10 flex items-center justify-center flex-shrink-0 mt-1">
              <CheckCircle className="w-5 h-5 text-[var(--success-green)]" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--brand-navy)] mb-1">What happens next?</h3>
              <ul className="text-sm text-[var(--neutral-gray)] space-y-1">
                <li>• You'll receive a WhatsApp message within 24 hours</li>
                <li>• You can schedule a visit or ask questions</li>
                <li>• Your interest is saved, no commitment required</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="space-y-3"
        >
          <Button
            onClick={onShare}
            variant="outline"
            className="w-full h-14 text-base font-semibold rounded-xl border-2 border-[var(--brand-navy)] text-[var(--brand-navy)] hover:bg-[var(--brand-navy)] hover:text-white"
          >
            <Share2 className="w-5 h-5 mr-2" />
            Share with Parents
          </Button>

          <Button
            onClick={onExploreMore}
            variant="outline"
            className="w-full h-14 text-base font-semibold rounded-xl"
          >
            Explore more rooms
          </Button>

          <Button
            onClick={handleWhatsApp}
            className="w-full h-14 text-base font-semibold rounded-xl bg-[var(--success-green)] hover:bg-[var(--success-green)]/90 text-white"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Chat on WhatsApp
          </Button>
        </motion.div>

        {/* Footer Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center text-sm text-[var(--neutral-gray)] mt-6"
        >
          You can mark multiple rooms as interested
        </motion.p>
      </div>
    </div>
  );
}
