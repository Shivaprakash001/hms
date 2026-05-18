import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, Search, X } from 'lucide-react';
import { paymentService, tenantService } from '@/api/services';
import { formatCurrency } from '@utils/format';

export function TestPaymentModal({ isOpen, onClose, hostelId, preferences }) {
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [amount, setAmount] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !hostelId) return;
    let active = true;
    setLoadingTenants(true);
    setError('');
    tenantService
      .getAll(hostelId, { limit: 200 })
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response)
          ? response
          : response?.tenants || response?.data?.tenants || [];
        setTenants(rows);
        const firstActive = rows.find(
          (t) => !['LEFT', 'CANCELLED', 'EXPIRED'].includes(t.status),
        );
        setSelectedTenantId(firstActive?.id || rows[0]?.id || '');
      })
      .catch((tenantError) => {
        if (!active) return;
        setError(
          tenantError?.response?.data?.detail?.message
            || tenantError?.response?.data?.detail
            || 'Could not load tenants for this hostel.',
        );
      })
      .finally(() => active && setLoadingTenants(false));
    return () => {
      active = false;
    };
  }, [hostelId, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setAmount('1');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  const tenantLabel = (tenant) => {
    const name = tenant.profile?.name || tenant.profiles?.name || tenant.name || 'Tenant';
    const email = tenant.profile?.email || tenant.profiles?.email || tenant.email || '';
    const room =
      tenant.allocations?.[0]?.room?.room_no
      || tenant.room_allocations?.[0]?.room?.room_no
      || 'N/A';
    return { name, email, room };
  };

  const filteredTenants = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant) => {
      const label = tenantLabel(tenant);
      return `${label.name} ${label.email} ${label.room}`.toLowerCase().includes(term);
    });
  }, [query, tenants]);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const selectedLabel = selectedTenant ? tenantLabel(selectedTenant) : null;
  const numericAmount = Number(amount);

  const startTestPayment = async () => {
    if (!selectedTenantId) {
      setError('Select a tenant first.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 100) {
      setError('Use a test amount between ₹1 and ₹100.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await paymentService.createTestIntent({
        tenant_id: selectedTenantId,
        hostelId,
        amount: numericAmount,
      });
      const attempt = result?.attempt || result;
      if (attempt?.checkout_url) {
        localStorage.setItem('lastPaymentAttemptId', attempt.id);
        localStorage.setItem(
          'lastPaymentMerchantTxnId',
          attempt.merchant_txn_id || attempt.merchant_transaction_id || '',
        );
        sessionStorage.setItem('lastPaymentAttemptId', attempt.id);
        window.location.href = attempt.checkout_url;
        return;
      }
      setError('The test due was created, but the provider did not return a checkout URL.');
    } catch (intentError) {
      setError(
        intentError?.response?.data?.detail?.message
          || intentError?.response?.data?.detail
          || intentError?.response?.data?.error?.message
          || 'Could not start the test payment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="absolute inset-0 flex items-end sm:items-center justify-center">
        <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
          <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-ops-accent font-medium">Treasury test checkout</p>
              <h2 className="text-lg font-semibold text-foreground mt-0.5">Test a tenant payment</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground rounded-lg border border-ops-info/20 bg-ops-info/5 px-3 py-2">
              Owner-only test charge through real PhonePe checkout, webhook, and ledger.
            </p>

            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <label className="block">
                <span className="block text-xs text-muted-foreground mb-1.5">Search tenant</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name, email, room"
                    className="w-full pl-9 pr-3 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ops-accent"
                  />
                </div>
              </label>
              <label className="block">
                <span className="block text-xs text-muted-foreground mb-1.5">Amount</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ops-accent"
                />
              </label>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {loadingTenants ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  Loading tenants
                </div>
              ) : filteredTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No tenant matches.</p>
              ) : (
                filteredTenants.map((tenant) => {
                  const label = tenantLabel(tenant);
                  const active = tenant.id === selectedTenantId;
                  return (
                    <button
                      key={tenant.id}
                      type="button"
                      onClick={() => setSelectedTenantId(tenant.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                        active
                          ? 'border-ops-accent bg-ops-accent/5'
                          : 'border-border bg-card hover:bg-secondary/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{label.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {label.email || 'No email'} · Room {label.room}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          active ? 'bg-ops-accent text-white' : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {active ? 'Selected' : tenant.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {selectedLabel && (
              <div className="rounded-lg border border-border bg-secondary/50 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Checkout for</p>
                <p className="font-medium text-foreground">
                  {selectedLabel.name} · Room {selectedLabel.room}
                </p>
                <p className="text-muted-foreground">
                  {formatCurrency(numericAmount || 0, preferences)} test charge
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-ops-danger bg-ops-danger/10 border border-ops-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={startTestPayment}
              disabled={submitting || loadingTenants || !selectedTenantId}
              className="w-full flex items-center justify-center gap-2 bg-ops-accent text-white py-4 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
              {submitting ? 'Starting checkout…' : 'Create test due & open checkout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
