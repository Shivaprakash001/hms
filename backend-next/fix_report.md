## 1. Root Cause
The root cause of the metric inconsistency is two-fold:
1. **Timezone Leakage (Local vs UTC)**: Month boundaries are constructed using local server time (`new Date(y, m, 1)`) instead of UTC. If the server is in IST (+05:30), May 1st 00:00 Local becomes April 30th 18:30 UTC. This causes Prisma to generate a `WHERE` clause that inadvertently includes payments from the last hours of April.
2. **Incorrect Timestamp Field**: The query is likely filtering by `created_at` (when the record was inserted into the database) instead of `paid_at` (the actual business event of payment collection). This causes delayed syncs or manual entries created in May for April dues to falsely inflate May's totals.

## 2. Broken Code Pattern
```typescript
// BAD: Relying on local server timezone
const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

const collection = await prisma.payment.aggregate({
  where: {
    // BAD: Using created_at instead of the source-of-truth paid_at
    created_at: { 
      gte: startOfMonth, 
      lt: nextMonthStart 
    }
  },
  _sum: { amount: true }
});
```

## 3. Fixed Prisma Query
```typescript
// 1. Get current UTC Year and Month
const now = new Date();
const utcYear = now.getUTCFullYear();
const utcMonth = now.getUTCMonth();

// 2. Define strict UTC-safe boundaries (Inclusive start, Exclusive end)
const startOfMonth = new Date(Date.UTC(utcYear, utcMonth, 1, 0, 0, 0, 0));
const nextMonthStart = new Date(Date.UTC(utcYear, utcMonth + 1, 1, 0, 0, 0, 0));

// 3. Query strictly on paid_at
const monthlyCollection = await prisma.payment.aggregate({
  where: {
    paid_at: {
      gte: startOfMonth,
      lt: nextMonthStart
    }
  },
  _sum: {
    amount: true
  }
});

const totalCollectedThisMonth = Number(monthlyCollection._sum.amount || 0);
```

## 4. SQL Verification Queries

**Sum of payments for current month (UTC):**
```sql
SELECT COALESCE(SUM(amount), 0) AS total_collected_current_month
FROM payments
WHERE paid_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC')
  AND paid_at < date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '1 month';
```

**Comparison against previous month (UTC):**
```sql
SELECT 
  COALESCE(SUM(CASE 
    WHERE paid_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC') 
      AND paid_at < date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '1 month' 
    THEN amount ELSE 0 END), 0) AS current_month_collected,
  COALESCE(SUM(CASE 
    WHERE paid_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC') - INTERVAL '1 month' 
      AND paid_at < date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC') 
    THEN amount ELSE 0 END), 0) AS previous_month_collected
FROM payments;
```

**Identify leaky records (April payments bleeding into May via created_at):**
```sql
SELECT id, amount, paid_at, created_at 
FROM payments 
WHERE created_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC')
  AND paid_at < date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC');
```

## 5. Edge Cases to Test
1. **Timezone boundaries:** A payment where `paid_at` is `2024-04-30T23:59:59.999Z` MUST NOT be included in May's total, regardless of the local server timezone.
2. **First millisecond of the month:** A payment where `paid_at` is `2024-05-01T00:00:00.000Z` MUST be included in May's total.
3. **Delayed insertions:** A payment that was paid in April (`paid_at` in April) but manually recorded into the system in May (`created_at` in May) MUST NOT show up in May's total.
4. **Unpaid Obligations:** Records in `rent_obligations` with `status = 'PENDING'` MUST NOT affect the "Total Collected" metric. Only successful records in the `payments` table should be summed.
