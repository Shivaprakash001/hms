
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Calendar, Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

// Mock Data
import { MOCK_PAYMENTS } from '../../utils/mockData';

// Components
import PaymentStatsCard from '../../components/owner/payments/PaymentStatsCard';
import PaymentTable from '../../components/owner/payments/PaymentTable';
import PaymentDetailsDrawer from '../../components/owner/payments/PaymentDetailsDrawer';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';

const Payments = () => {
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);

    // Initial Data Load
    useEffect(() => {
        // Simulate API call
        setTimeout(() => {
            setPayments(MOCK_PAYMENTS);
            setIsLoading(false);
        }, 800);
    }, []);

    // Derived State: filtered payments
    const filteredPayments = useMemo(() => {
        return payments.filter(payment => {
            const matchesSearch = payment.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                payment.room.toString().includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
            const matchesMonth = monthFilter === 'all' || payment.month === monthFilter;

            return matchesSearch && matchesStatus && matchesMonth;
        });
    }, [payments, searchTerm, statusFilter, monthFilter]);

    // Derived State: stats
    const stats = useMemo(() => {
        const totalCollected = payments
            .filter(p => p.status === 'paid')
            .reduce((acc, curr) => acc + curr.amount, 0);

        const totalPending = payments
            .filter(p => p.status === 'pending' || p.status === 'overdue')
            .reduce((acc, curr) => acc + curr.amount, 0);

        const uniqueTenants = new Set(payments.map(p => p.tenantName)).size;

        return { totalCollected, totalPending, uniqueTenants };
    }, [payments]);

    // Handlers
    const handleMarkAsPaid = (paymentId) => {
        const updatedPayments = payments.map(p =>
            p.id === paymentId ? { ...p, status: 'paid', date: new Date().toISOString().split('T')[0], method: 'Manual' } : p
        );
        setPayments(updatedPayments);

        // Update selected payment if open
        if (selectedPayment && selectedPayment.id === paymentId) {
            setSelectedPayment({ ...selectedPayment, status: 'paid', date: new Date().toISOString().split('T')[0], method: 'Manual' });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments</h1>
                    <p className="text-slate-500 text-sm">Track and manage tenant payments</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm font-semibold text-sm">
                        <Download size={16} /> Export Report
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all font-semibold text-sm active:scale-95">
                        <DollarSign size={16} /> Record Payment
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PaymentStatsCard
                    title="Total Collected"
                    value={`₹${stats.totalCollected.toLocaleString()}`}
                    type="success"
                    icon={TrendingUp}
                    subtext={<span className="text-emerald-600 flex items-center gap-1"><TrendingUp size={12} /> +12% from last month</span>}
                />
                <PaymentStatsCard
                    title="Pending Dues"
                    value={`₹${stats.totalPending.toLocaleString()}`}
                    type="warning"
                    icon={TrendingDown}
                    subtext={<span className="text-amber-600 flex items-center gap-1"> Action required for 3 tenants</span>}
                />
                <PaymentStatsCard
                    title="Active Tenants"
                    value={stats.uniqueTenants}
                    type="primary"
                    icon={DollarSign}
                    subtext={<span className="text-indigo-600">Total occupancy</span>}
                />
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Filters Bar */}
                <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-4 justify-between items-center sticky top-0 z-10">
                    <div className="relative w-full sm:w-72 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search tenant or room..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                        <select
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300 transition-all cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="overdue">Overdue</option>
                        </select>

                        <select
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300 transition-all cursor-pointer"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                        >
                            <option value="all">All Months</option>
                            <option value="February 2024">February 2024</option>
                            <option value="January 2024">January 2024</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <PaymentTable
                    payments={filteredPayments}
                    onSelectPayment={setSelectedPayment}
                    onViewHistory={setHistoryTenant}
                />

                {/* Pagination (Simple) */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                    <span>Showing {filteredPayments.length} results</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                        <button className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
                    </div>
                </div>
            </div>

            {/* Details Drawer */}
            <PaymentDetailsDrawer
                isOpen={!!selectedPayment}
                onClose={() => setSelectedPayment(null)}
                payment={selectedPayment}
                onMarkPaid={handleMarkAsPaid}
            />

            {/* Tenant History Modal */}
            <TenantHistoryModal
                isOpen={!!historyTenant}
                onClose={() => setHistoryTenant(null)}
                tenantId={historyTenant?.tenantId}
                tenantName={historyTenant?.tenantName}
            />
        </div>
    );
};

export default Payments;
