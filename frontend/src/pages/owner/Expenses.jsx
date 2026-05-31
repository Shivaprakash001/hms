import React, { useState, useMemo, useEffect } from 'react';
import {
    Plus, Filter, Trash, Edit, X, Zap, Wrench, Utensils, Box,
    Search, Calendar, ArrowUpRight, ArrowDownRight, Download,
    AlertCircle, CheckCircle2, Loader2, Store, CreditCard, User, ChevronDown, ChevronUp, Lightbulb, Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '../../hooks/useExpenses';
import { useHostelContext } from '../../context/HostelContext';

const getCategoryStyles = (category) => {
    const styles = {
        'Electricity': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: Zap },
        'Repairs': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', icon: Wrench },
        'Food & Groceries': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: Utensils },
        'Staff Salary': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', icon: User },
        'Water': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-100', icon: Box },
        'Gas Cylinder': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', icon: Box },
        'Internet': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', icon: Zap },
        'Cleaning': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100', icon: Box },
        'Asset Purchase': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', icon: Box },
        'Miscellaneous': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-100', icon: Box }
    };
    return styles[category] || styles['Miscellaneous'];
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const SummaryCard = ({ title, amount, previous, type, margin }) => {
    const isUp = amount > previous;
    const diff = previous > 0 ? Math.round(Math.abs(amount - previous) / previous * 100) : (amount > 0 ? 100 : 0);
    
    let color = "text-slate-500";
    let bg = "bg-slate-50";
    let context = "No previous data";
    
    if (type === "revenue") {
        color = isUp ? "text-emerald-600" : "text-amber-600";
        bg = isUp ? "bg-emerald-50" : "bg-amber-50";
        context = isUp ? `Up ${diff}% vs last month` : `Down ${diff}% vs last month`;
    } else if (type === "expense") {
        color = isUp ? "text-rose-600" : "text-emerald-600";
        bg = isUp ? "bg-rose-50" : "bg-emerald-50";
        context = isUp ? `Up ${diff}% vs last month` : `Down ${diff}% vs last month`;
    } else if (type === "profit") {
        const isHealthy = margin >= 25;
        color = isUp ? "text-emerald-600" : "text-rose-600";
        bg = isUp ? "bg-emerald-50" : "bg-rose-50";
        context = isHealthy ? "Healthy margin" : "Margin needs attention";
    }

    if (previous === 0 && amount === 0) {
        context = "No data yet";
        color = "text-slate-500";
        bg = "bg-slate-100";
    }

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start z-10">
                <p className="text-sm font-bold text-slate-500">{title}</p>
            </div>
            <div className="mt-2 z-10">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">₹{(amount || 0).toLocaleString('en-IN')}</h3>
                <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${bg} ${color}`}>
                        {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {diff}%
                    </span>
                    <span className="text-xs font-medium text-slate-500">{context}</span>
                </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-110 transition-transform pointer-events-none" />
        </div>
    );
};

const InsightsAccordion = ({ insights }) => {
    const [isOpen, setIsOpen] = useState(() => {
        const stored = localStorage.getItem('hms_expenses_insights_open');
        return stored !== null ? stored === 'true' : false;
    });

    const toggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        localStorage.setItem('hms_expenses_insights_open', String(next));
    };

    if (!insights || insights.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button 
                onClick={toggle} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                        <Lightbulb size={16} />
                    </div>
                    <span className="font-bold text-sm text-slate-900">AI Insights</span>
                </div>
                <div className="text-slate-400">
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </button>
            
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 space-y-3 border-t border-slate-100">
                            {insights.map((insight, idx) => (
                                <div key={idx} className="flex gap-3 items-start">
                                    <div className={`mt-0.5 p-1 rounded-full shrink-0 ${
                                        insight.severity === 'dangerous' ? 'bg-rose-100 text-rose-600' :
                                        insight.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                                        'bg-emerald-100 text-emerald-600'
                                    }`}>
                                        <AlertCircle size={14} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{insight.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const MonthlyBreakdown = ({ categories, total }) => {
    if (!categories || categories.length === 0) return null;
    
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Monthly Breakdown</h3>
            <div className="space-y-4">
                {categories.slice(0, 5).map(cat => {
                    const style = getCategoryStyles(cat.category);
                    return (
                        <div key={cat.category} className="group">
                            <div className="flex justify-between items-end mb-1.5">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${style.bg} ${style.text}`}>
                                        <style.icon size={14} />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700">{cat.category}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-black text-slate-900">₹{cat.amount.toLocaleString('en-IN')}</span>
                                    <span className="text-[10px] font-medium text-slate-500 ml-2">{cat.percentage}%</span>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${style.bg.replace('50', '500').replace('10', '100').replace('bg-ops-accent/100', 'bg-ops-accent')}`} 
                                    style={{ width: `${cat.percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TopVendors = ({ expenses }) => {
    const vendors = useMemo(() => {
        const vMap = {};
        expenses.forEach(exp => {
            const v = exp.vendor_name;
            if (!v) return;
            if (!vMap[v]) vMap[v] = { name: v, amount: 0, count: 0, category: exp.category, lastDate: exp.date };
            vMap[v].amount += exp.amount;
            vMap[v].count += 1;
            if (new Date(exp.date) > new Date(vMap[v].lastDate)) vMap[v].lastDate = exp.date;
        });
        return Object.values(vMap)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 4);
    }, [expenses]);

    if (vendors.length === 0) return null;

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Top Vendors</h3>
            <div className="space-y-4">
                {vendors.map(v => {
                    const style = getCategoryStyles(v.category);
                    return (
                        <div key={v.name} className="flex justify-between items-center p-3 rounded-xl border border-slate-50 hover:border-slate-200 transition-colors bg-slate-50/50">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{v.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-500">{v.count} txn{v.count > 1 ? 's' : ''}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[10px] font-semibold text-slate-500">{v.category}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                                <span className="text-sm font-black text-slate-900">₹{v.amount.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const EmptyState = ({ searchQuery, categoryFilter }) => {
    let title = "No expenses recorded yet";
    let sub = "Add your first expense to track your outflow.";
    
    if (searchQuery) {
        title = `No results for "${searchQuery}"`;
        sub = "Try adjusting your search terms.";
    } else if (categoryFilter !== 'all') {
        if (categoryFilter === 'Staff Salary') {
            title = "No staff salary entries this month";
            sub = "When you pay your staff, record it here.";
        } else if (categoryFilter === 'Repairs') {
            title = "No repair expenses yet";
            sub = "Looks like everything is working perfectly!";
        } else {
            title = `No ${categoryFilter.toLowerCase()} expenses`;
            sub = "You haven't recorded any expenses in this category.";
        }
    }

    return (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100 shadow-sm border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Receipt size={24} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-1">{sub}</p>
        </div>
    );
};

export default function Expenses() {
    const { hostelId } = useHostelContext();
    const { data: rawData, isLoading, isError } = useExpenses(hostelId);
    
    const responseData = rawData?.data || rawData || {};
    const expenses = Array.isArray(responseData) ? responseData : responseData.expenses || [];
    const kpis = responseData.kpis || {};
    const categoryBreakdown = responseData.category_breakdown || [];
    const insights = responseData.insights || [];
    const backendCategories = responseData.meta?.categories || [
        "Food & Groceries", "Staff Salary", "Electricity", "Water", 
        "Gas Cylinder", "Internet", "Repairs", "Cleaning", "Asset Purchase", "Miscellaneous"
    ];

    const createMutation = useCreateExpense(hostelId);
    const updateMutation = useUpdateExpense(hostelId);
    const deleteMutation = useDeleteExpense(hostelId);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    
    const initialFormState = {
        title: '',
        amount: '',
        category: 'Miscellaneous',
        date: new Date().toISOString().split('T')[0],
        status: 'paid',
        vendor_name: '',
        payment_method: 'upi'
    };
    
    const [formData, setFormData] = useState(initialFormState);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const resetForm = () => {
        setFormData(initialFormState);
        setEditingExpense(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const expenseData = {
            ...formData,
            amount: Number(formData.amount),
        };

        try {
            if (editingExpense) {
                await updateMutation.mutateAsync({ id: editingExpense.id, data: expenseData });
            } else {
                await createMutation.mutateAsync(expenseData);
            }
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error("Failed to save expense:", error);
            alert("Failed to save expense");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                await deleteMutation.mutateAsync(id);
            } catch (error) {
                console.error("Failed to delete expense:", error);
                alert("Failed to delete expense");
            }
        }
    };

    const handleMarkAsPaid = async (expense) => {
        try {
            await updateMutation.mutateAsync({ id: expense.id, data: { status: 'paid' } });
        } catch (error) {
            console.error("Failed to mark as paid:", error);
            alert("Failed to mark as paid");
        }
    };

    const openEditModal = (expense) => {
        setEditingExpense(expense);
        setFormData({
            title: expense.title || '',
            amount: expense.amount || '',
            category: expense.category || 'Miscellaneous',
            date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
            status: expense.status || 'paid',
            vendor_name: expense.vendor_name || '',
            payment_method: expense.payment_method || 'upi'
        });
        setIsModalOpen(true);
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const searchStr = `${expense.title} ${expense.vendor_name || ''} ${expense.category}`.toLowerCase();
            const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [expenses, searchQuery, categoryFilter]);

    const handleDownloadExpenses = () => {
        if (filteredExpenses.length === 0) return alert('No expenses to download.');
        try {
            setIsExporting(true);
            const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const rows = [
                ['Title', 'Category', 'Date', 'Amount', 'Status', 'Vendor', 'Payment Method'],
                ...filteredExpenses.map((e) => [
                    e.title, e.category, e.date, e.amount, e.status, e.vendor_name || '', e.payment_method || ''
                ])
            ];
            const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `expenses_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert('Export failed.');
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                <Loader2 size={32} className="mb-3 animate-spin opacity-40" />
                <p className="text-sm font-semibold">Loading expenses…</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                <AlertCircle size={32} className="mb-3 opacity-40 text-rose-400" />
                <p className="text-sm font-semibold text-rose-600">Failed to load expenses</p>
                <p className="text-xs mt-1">Please refresh the page and try again</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-24 lg:pb-8 font-sans animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Expenses</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage outflow and operational costs</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="hidden lg:flex items-center justify-center gap-2 px-4 py-2.5 bg-ops-accent hover:bg-ops-accent/90 text-white rounded-xl shadow-sm transition-all text-sm font-bold active:scale-95"
                >
                    <Plus size={18} /> Add Expense
                </button>
            </div>

            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <SummaryCard title="Collected Revenue" amount={kpis.collected_revenue} previous={kpis.previous_collected_revenue} type="revenue" />
               <SummaryCard title="Total Expenses" amount={kpis.this_month_expenses} previous={kpis.last_month_expenses} type="expense" />
               <SummaryCard title="Net Profit" amount={kpis.net_profit} previous={kpis.previous_collected_revenue - kpis.last_month_expenses} type="profit" margin={kpis.profit_margin} />
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Main Content Area (Filters + List) */}
                <div className="lg:col-span-8 space-y-4">
                    
                    {/* Compact Filters */}
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-3 items-center sticky top-16 z-30 lg:static">
                        <div className="relative w-full sm:w-64 shrink-0 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-ops-accent transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ops-accent/20 focus:bg-white w-full transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                            <button
                                onClick={() => setCategoryFilter('all')}
                                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm
                                    ${categoryFilter === 'all' 
                                        ? 'bg-slate-900 text-white' 
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                            >
                                All
                            </button>
                            {backendCategories.map(cat => {
                                const style = getCategoryStyles(cat);
                                const isActive = categoryFilter === cat;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(cat)}
                                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border whitespace-nowrap
                                            ${isActive
                                                ? `bg-white border-ops-accent text-ops-accent ring-1 ring-ops-accent shadow-ops-accent/10`
                                                : `bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300`
                                            }`}
                                    >
                                        <style.icon size={12} className={isActive ? 'text-ops-accent' : 'text-slate-400'} />
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={handleDownloadExpenses}
                            disabled={isExporting}
                            className="hidden sm:flex shrink-0 p-2 text-slate-400 hover:text-ops-accent hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200"
                        >
                            <Download size={18} />
                        </button>
                    </div>

                    {/* Expense List */}
                    <div className="space-y-3">
                        {filteredExpenses.length === 0 ? (
                            <EmptyState searchQuery={searchQuery} categoryFilter={categoryFilter} />
                        ) : (
                            filteredExpenses.map((expense) => {
                                const style = getCategoryStyles(expense.category);
                                return (
                                    <motion.div
                                        key={expense.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden group hover:border-slate-200 transition-colors"
                                    >
                                        {/* Status Indicator Bar */}
                                        <div className={`absolute top-0 left-0 w-1 h-full ${expense.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                        
                                        <div className="flex-1 pl-2 space-y-2">
                                            {/* Row 1: Title & Amount (Mobile) / Title (Desktop) */}
                                            <div className="flex justify-between items-start">
                                                <h3 className="text-sm font-bold text-slate-900 line-clamp-1 pr-2 group-hover:text-ops-accent transition-colors">
                                                    {expense.title}
                                                </h3>
                                                <span className="sm:hidden text-lg font-black text-slate-900 tracking-tight shrink-0">
                                                    ₹{expense.amount.toLocaleString('en-IN')}
                                                </span>
                                            </div>

                                            {/* Row 2: Category & Date */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                                                    <style.icon size={12} strokeWidth={2.5} />
                                                    {expense.category}
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-xs font-medium text-slate-500">{formatDate(expense.date)}</span>
                                            </div>

                                            {/* Row 3: Meta Info (Vendor, Payment, User) */}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
                                                {expense.vendor_name && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                                        <Store size={12} className="text-slate-400" />
                                                        <span>{expense.vendor_name}</span>
                                                    </div>
                                                )}
                                                {expense.payment_method && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                                        <CreditCard size={12} className="text-slate-400" />
                                                        <span className="capitalize">{expense.payment_method.replace('_', ' ')}</span>
                                                    </div>
                                                )}
                                                {expense.added_by && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium hidden sm:flex">
                                                        <User size={12} className="text-slate-400" />
                                                        <span>By {expense.added_by}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Desktop Amount & Actions */}
                                        <div className="hidden sm:flex flex-col items-end gap-3 pl-4 border-l border-slate-50">
                                            <span className="text-xl font-black text-slate-900 tracking-tight">
                                                ₹{expense.amount.toLocaleString('en-IN')}
                                            </span>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {expense.status !== 'paid' && (
                                                    <button onClick={() => handleMarkAsPaid(expense)} className="p-1.5 text-slate-400 hover:text-emerald-600 bg-emerald-50 rounded-lg transition-colors" title="Mark Paid">
                                                        <CheckCircle2 size={14} />
                                                    </button>
                                                )}
                                                <button onClick={() => openEditModal(expense)} className="p-1.5 text-slate-400 hover:text-ops-accent bg-slate-50 rounded-lg transition-colors">
                                                    <Edit size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(expense.id)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-rose-50 rounded-lg transition-colors">
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mobile Actions */}
                                        <div className="sm:hidden flex items-center justify-between pt-3 border-t border-slate-50 pl-2">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${expense.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {expense.status === 'paid' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                                <span className="capitalize">{expense.status}</span>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {expense.status !== 'paid' && (
                                                    <button onClick={() => handleMarkAsPaid(expense)} className="p-1.5 text-slate-400 hover:text-emerald-600 bg-emerald-50 rounded-lg"><CheckCircle2 size={16} /></button>
                                                )}
                                                <button onClick={() => openEditModal(expense)} className="p-1.5 text-slate-400 hover:text-ops-accent bg-slate-50 rounded-lg"><Edit size={16} /></button>
                                                <button onClick={() => handleDelete(expense.id)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-rose-50 rounded-lg"><Trash size={16} /></button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Sidebar Column */}
                <div className="lg:col-span-4 space-y-6">
                    <InsightsAccordion insights={insights} />
                    <MonthlyBreakdown categories={categoryBreakdown} total={kpis.this_month_expenses} />
                    <TopVendors expenses={expenses} />
                </div>
            </div>

            {/* Mobile FAB */}
            <button
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                className="lg:hidden fixed bottom-20 right-4 z-40 w-14 h-14 bg-ops-accent text-white rounded-full shadow-xl shadow-teal-900/20 flex items-center justify-center active:scale-95 transition-transform"
            >
                <Plus size={24} />
            </button>

            {/* Expense Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
                        >
                            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingExpense ? 'Edit Expense' : 'Add New Expense'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Description</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-ops-accent/50 focus:ring-2 focus:ring-ops-accent/20 outline-none transition-all text-sm font-medium"
                                        placeholder="e.g. Plumber for Room 102"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={formData.amount}
                                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-ops-accent/50 focus:ring-2 focus:ring-ops-accent/20 outline-none transition-all text-sm font-black text-slate-900"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-ops-accent/50 focus:ring-2 focus:ring-ops-accent/20 outline-none transition-all text-sm font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-ops-accent/50 focus:ring-2 focus:ring-ops-accent/20 outline-none transition-all text-sm font-medium text-slate-700"
                                        >
                                            {backendCategories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-ops-accent/50 focus:ring-2 focus:ring-ops-accent/20 outline-none transition-all text-sm font-medium text-slate-700"
                                        >
                                            <option value="paid">Paid</option>
                                            <option value="pending">Pending</option>
                                            <option value="overdue">Overdue</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Vendor (Optional)</label>
                                        <input
                                            type="text"
                                            value={formData.vendor_name}
                                            onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-ops-accent/50 focus:ring-2 focus:ring-ops-accent/20 outline-none transition-all text-sm font-medium"
                                            placeholder="e.g. Urban Company"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
                                        <select
                                            value={formData.payment_method}
                                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-ops-accent/50 focus:ring-2 focus:ring-ops-accent/20 outline-none transition-all text-sm font-medium text-slate-700"
                                        >
                                            <option value="upi">UPI</option>
                                            <option value="cash">Cash</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="card">Card</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3 border-t border-slate-50 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-ops-accent text-white text-sm font-bold hover:bg-ops-accent/90 transition-all shadow-lg shadow-teal-500/20 active:scale-95"
                                    >
                                        {editingExpense ? 'Save Changes' : 'Add Expense'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
