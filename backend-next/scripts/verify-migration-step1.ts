import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    const talNulls = await prisma.tenantAdvanceLedger.count({ where: { hostel_id: null } });
    const paNulls = await prisma.paymentAttempt.count({ 
      where: { 
        obligation_id: { not: null }, 
        hostel_id: null 
      } 
    });
    const wlNulls = await prisma.whatsappLog.count({ 
      where: { 
        OR: [
          { obligation_id: { not: null } }, 
          { tenant_id: { not: null } }
        ], 
        hostel_id: null 
      } 
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Step 1 Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('tenant_advance_ledger NULL hostel_id:', talNulls);
    console.log('payment_attempts NULL hostel_id (with obligation):', paNulls);
    console.log('whatsapp_logs NULL hostel_id (with obligation/tenant):', wlNulls);
    console.log('');
    
    if (talNulls === 0 && paNulls === 0) {
      console.log('✅ All backfills complete! Ready for Step 2.');
    } else {
      console.log('❌ Some NULLs remain - DO NOT proceed to Step 2');
    }
    console.log('');
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
