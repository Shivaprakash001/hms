import { DollarSign, PlusCircle, Bell, Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface Props {
  hostelId: string;
  onRecordPayment?: () => void;
  onAddExpense?: () => void;
}

export function OwnerActionsBar({ hostelId, onRecordPayment, onAddExpense }: Props) {
  const handleExport = () => {
    const url = `/api/payments/export?hostelId=${hostelId}&format=csv`;
    window.open(url, '_blank');
  };

  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1 hidden sm:block">
        Actions
      </span>

      {onRecordPayment && (
        <Button size="sm" onClick={onRecordPayment} className="gap-1.5 h-8">
          <DollarSign className="h-3.5 w-3.5" />
          <span>Record Payment</span>
        </Button>
      )}

      {onAddExpense && (
        <Button size="sm" variant="outline" onClick={onAddExpense} className="gap-1.5 h-8">
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Add Expense</span>
        </Button>
      )}

      <Button size="sm" variant="outline" className="gap-1.5 h-8" asChild>
        <a href={`/hostels/${hostelId}/reminders`}>
          <Bell className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Send Reminders</span>
          <span className="sm:hidden">Remind</span>
        </a>
      </Button>

      <Button size="sm" variant="ghost" onClick={handleExport} className="gap-1.5 h-8 text-muted-foreground">
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
      </Button>
    </div>
  );
}
