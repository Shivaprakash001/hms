import React from 'react';

export function AdvancedPaymentTable({ onRowClick }: { onRowClick: (payment: any) => void }) {
  const dummyData = [
    { id: '1', tenant: 'Varun Kumar', room: '101', status: 'PAID', amount: '₹5,000', method: 'UPI', date: 'May 02', risk: 'LOW RISK' },
    { id: '2', tenant: 'Rahul Sharma', room: '105', status: 'OVERDUE', amount: '₹4,500', method: '-', date: 'Due May 01', risk: 'HIGH RISK' },
    { id: '3', tenant: 'Karthik S', room: '202', status: 'PARTIAL', amount: '₹2,000', method: 'CASH', date: 'May 03', risk: 'WATCHLIST' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="p-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Tenant</th>
            <th className="p-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Room</th>
            <th className="p-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
            <th className="p-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Amount</th>
            <th className="p-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Method & Date</th>
            <th className="p-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {dummyData.map((row) => (
            <tr 
              key={row.id} 
              onClick={() => onRowClick(row)}
              className="hover:bg-muted/30 cursor-pointer transition-colors"
            >
              <td className="p-3 text-sm font-medium text-foreground whitespace-nowrap">{row.tenant}</td>
              <td className="p-3 text-sm text-foreground whitespace-nowrap">{row.room}</td>
              <td className="p-3 whitespace-nowrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  row.status === 'PAID' ? 'bg-[#10B981]/15 text-[#10B981]' : 
                  row.status === 'OVERDUE' ? 'bg-destructive/15 text-destructive' : 
                  'bg-[#F59E0B]/15 text-[#F59E0B]'
                }`}>
                  {row.status}
                </span>
              </td>
              <td className="p-3 font-semibold text-sm whitespace-nowrap">{row.amount}</td>
              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                <div className="font-medium text-foreground">{row.method}</div>
                <div>{row.date}</div>
              </td>
              <td className="p-3 text-xs whitespace-nowrap">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                    row.risk === 'LOW RISK' ? 'border-[#10B981]/30 text-[#10B981] bg-[#10B981]/5' :
                    row.risk === 'HIGH RISK' ? 'border-destructive/30 text-destructive bg-destructive/5' :
                    'border-[#F59E0B]/30 text-[#F59E0B] bg-[#F59E0B]/5'
                }`}>
                  {row.risk}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
