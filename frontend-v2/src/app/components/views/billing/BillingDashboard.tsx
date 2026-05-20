import React, { useState } from 'react';
import { FinancialSummaryStrip } from './FinancialSummaryStrip';
import { CashflowCharts } from './CashflowCharts';
import { SmartFilters } from './SmartFilters';
import { AdvancedPaymentTable } from './AdvancedPaymentTable';
import { OverdueIntelligence } from './OverdueIntelligence';
import { PaymentDetailDrawer } from './PaymentDetailDrawer';

export function BillingDashboard() {
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  return (
    <div className="px-4 py-6 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Financial Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor revenue, cashflow, and payment health across properties.
          </p>
        </div>
      </div>

      <FinancialSummaryStrip />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CashflowCharts />
          
          <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
            <SmartFilters />
            <AdvancedPaymentTable onRowClick={setSelectedPayment} />
          </div>
        </div>
        
        <div className="space-y-6">
          <OverdueIntelligence />
        </div>
      </div>

      {selectedPayment && (
        <PaymentDetailDrawer 
          payment={selectedPayment} 
          onClose={() => setSelectedPayment(null)} 
        />
      )}
    </div>
  );
}
