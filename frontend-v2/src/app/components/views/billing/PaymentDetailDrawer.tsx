import React from 'react';
import { X, ExternalLink, Download, FileText, CheckCircle, Clock } from 'lucide-react';

export function PaymentDetailDrawer({ payment, onClose }: { payment: any, onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-background border-l border-border shadow-2xl z-50 flex flex-col transform transition-transform">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {payment.tenant?.charAt(0) || 'T'}
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">{payment.tenant}</h2>
              <p className="text-xs text-muted-foreground">Room {payment.room} • Hostel A</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Status Hero */}
          <div className="bg-muted/20 border border-border rounded-xl p-5 text-center">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                  payment.status === 'PAID' ? 'bg-[#10B981]/15 text-[#10B981]' : 
                  payment.status === 'OVERDUE' ? 'bg-destructive/15 text-destructive' : 
                  'bg-[#F59E0B]/15 text-[#F59E0B]'
            }`}>
              {payment.status === 'PAID' ? <CheckCircle className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
              {payment.status}
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{payment.amount}</div>
            <div className="text-sm text-muted-foreground">Rent Month: May 2026</div>
          </div>

          {/* Transaction Details */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Transaction Details</h4>
            <div className="bg-card border border-border rounded-lg p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">{payment.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid Date</span>
                <span className="font-medium">{payment.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Txn ID</span>
                <span className="font-medium font-mono text-xs">txn_gq82nf7</span>
              </div>
            </div>
          </div>

          {/* Rent Breakdown */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Rent Breakdown</h4>
            <div className="bg-card border border-border rounded-lg p-3 text-sm space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Base Rent</span>
                <span>₹4,500</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Maintenance</span>
                <span>₹500</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Late Fee</span>
                <span>₹0</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>Total</span>
                <span>₹5,000</span>
              </div>
            </div>
          </div>

        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-border bg-muted/10 shrink-0 grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-2 border border-border bg-background rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4"/> Receipt
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <FileText className="w-4 h-4"/> View Profile
          </button>
        </div>
      </div>
    </>
  );
}
