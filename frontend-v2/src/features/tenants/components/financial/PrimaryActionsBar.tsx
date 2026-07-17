import { useState } from 'react';
import { IndianRupee, ReceiptText, CalendarPlus, Share2, FileStack, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { paymentService } from '@features/payments/api';
import { hmsToast } from '@lib/toast';
import { useIsMobile } from '@/app/components/ui/use-mobile';

interface PrimaryAction {
  key: string;
  label: string;
  icon: typeof IndianRupee;
  onClick: () => void;
  emphasis?: boolean;
}

interface PrimaryActionsBarProps {
  tenantId: string;
  onReceivePayment: () => void;
  onCreateCharge: () => void;
  onCreateRent: () => void;
  onViewReceipts: () => void;
}

export function PrimaryActionsBar({
  tenantId,
  onReceivePayment,
  onCreateCharge,
  onCreateRent,
  onViewReceipts,
}: PrimaryActionsBarProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSharePaymentLink = async () => {
    try {
      const res = await paymentService.generatePayLink({ tenantId });
      const paymentLink = res.url;
      window.open(`https://wa.me/?text=${encodeURIComponent(`Here is your payment link: ${paymentLink}`)}`, '_blank');
      toast.success('Payment link composed in WhatsApp');
    } catch (e: any) {
      hmsToast.error(e, 'Generate payment link');
    }
  };

  const actions: PrimaryAction[] = [
    { key: 'receive', label: 'Receive Payment', icon: IndianRupee, onClick: onReceivePayment, emphasis: true },
    { key: 'charge', label: 'Create Charge', icon: ReceiptText, onClick: onCreateCharge },
    { key: 'rent', label: 'Create Rent', icon: CalendarPlus, onClick: onCreateRent },
    { key: 'link', label: 'Share Payment Link', icon: Share2, onClick: handleSharePaymentLink },
    { key: 'receipts', label: 'View Receipts', icon: FileStack, onClick: onViewReceipts },
  ];

  if (isMobile) {
    return (
      <div id="fin-actions" className="scroll-mt-20">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-accent text-accent-foreground text-sm font-bold active:scale-98 transition-transform shadow-sm"
        >
          <IndianRupee className="w-4 h-4" />
          <span>Actions</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        {sheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full rounded-t-3xl border-t border-border bg-card p-4 pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">Actions</h3>
                <button type="button" onClick={() => setSheetOpen(false)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => {
                      setSheetOpen(false);
                      action.onClick();
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold active:scale-98 transition-transform ${
                      action.emphasis
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-secondary text-foreground border border-border'
                    }`}
                  >
                    <action.icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="fin-actions" className="flex flex-wrap gap-2 scroll-mt-20">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm ${
            action.emphasis
              ? 'bg-accent text-accent-foreground hover:bg-accent/90'
              : 'bg-secondary text-foreground border border-border hover:bg-secondary/80'
          }`}
        >
          <action.icon className="w-4 h-4" />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
