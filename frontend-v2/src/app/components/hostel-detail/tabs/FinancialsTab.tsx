import { lazy, Suspense, useState } from 'react';
import { TabSkeleton } from '../shared/TabStates';

const RecordPaymentModal = lazy(() => import('../../modals/RecordPaymentModal').then((m) => ({ default: m.RecordPaymentModal })));
const FinancialControlCenter = lazy(() => import('../../views/billing/FinancialControlCenter').then((m) => ({ default: m.FinancialControlCenter })));

export function FinancialsTab({ hostelId }: { hostelId: string }) {
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  return (
    <>
      <Suspense fallback={<TabSkeleton />}>
        <FinancialControlCenter
          hostelId={hostelId}
          onRecordPayment={() => setShowRecordPayment(true)}
        />
      </Suspense>
      {showRecordPayment && (
        <Suspense fallback={null}>
          <RecordPaymentModal hostelId={hostelId} onClose={() => setShowRecordPayment(false)} />
        </Suspense>
      )}
    </>
  );
}

