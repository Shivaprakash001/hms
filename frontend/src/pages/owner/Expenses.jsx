
import React, { useState, useMemo } from 'react';
import {
    Plus, Filter, Trash, Edit, X, IndianRupee, Zap, Wrench, Utensils, Box,
    Search, Calendar, ArrowUpRight, ArrowDownRight, MoreHorizontal, Download,
    AlertCircle, CheckCircle2
} from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

import { expenseService } from '../../api/services';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatCurrency, formatDate } from '../../utils/format';

export default function Expenses() {
    const { preferences } = useAppPreferences();
    const [expenses, setExpenses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: 'Maintenance',
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
    });
    const [dateFilter, setDateFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Fetch expenses on mount
    React.useEffect(() => {
        loadExpenses();
    }, []);

    const loadExpenses = async () => {
        try {
            setIsLoading(true);
            const response = await expenseService.getAll();
            // response is already response.data from axios
            // Backend wraps as { success: true, data: [...] }
            // But the router returns the list directly via _handle_response
            let list = [];
            if (Array.isArray(response)) {
                list = response;
            } else if (Array.isArray(response?.data)) {
                list = response.data;
            }
            setExpenses(list);
        } catch (error) {
            console.error("Failed to load expenses:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            amount: '',
            category: 'Maintenance',
            date: new Date().toISOString().split('T')[0],
            status: 'pending'
        });
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
                await expenseService.update(editingExpense.id, expenseData);
            } else {
                await expenseService.create(expenseData);
            }
            // Refresh list
            loadExpenses();
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
                await expenseService.delete(id);
                loadExpenses(); // Refresh
            } catch (error) {
                console.error("Failed to delete expense:", error);
                alert("Failed to delete expense");
            }
        }
    };

    const handleMarkAsPaid = async (expense) => {
        try {
            await expenseService.update(expense.id, { status: 'paid' });
            // Optimistically update local state until reload
            setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, status: 'paid' } : e));
        } catch (error) {
            console.error("Failed to mark as paid:", error);
            alert("Failed to mark as paid: " + (error.response?.data?.detail || error.message));
        }
    };

    const openEditModal = (expense) => {
        setEditingExpense(expense);
        setFormData({
            title: expense.title,
            amount: expense.amount,
            category: expense.category,
            date: expense.date,
            status: expense.status || 'pending'
        });
        setIsModalOpen(true);
    };

    // Derived State
    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const matchesSearch = expense.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
            const matchDate = () => {
                const expenseDate = new Date(expense.date);
                const today = new Date();


                switch (dateFilter) {
                    case 'today':
                        return expenseDate.toDateString() === new Date().toDateString();
                    case 'week': {
                        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
                        return expenseDate >= startOfWeek;
                    }
                    case 'month':
                        return expenseDate.getMonth() === new Date().getMonth() &&
                            expenseDate.getFullYear() === new Date().getFullYear();
                    case 'year':
                        return expenseDate.getFullYear() === new Date().getFullYear();
                    default:
                        return true;
                }
            };

            return matchesSearch && matchesCategory && matchDate();
        });
    }, [expenses, searchQuery, categoryFilter, dateFilter]);

    const totalStats = useMemo(() => {
        const total = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
        return {
            total,
            count: filteredExpenses.length,
            avg: filteredExpenses.length ? Math.round(total / filteredExpenses.length) : 0
        };
    }, [filteredExpenses]);

    const categories = ['Electricity', 'Maintenance', 'Food', 'Utilities', 'Other'];

    const getCategoryStyles = (category) => {
        const styles = {
            'Electricity': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: Zap },
            'Maintenance': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', icon: Wrench },
            'Food': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: Utensils },
            'Utilities': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', icon: Box },
            'Other': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-100', icon: Box }
        };
        return styles[category] || styles['Other'];
    };

    const handleDownloadExpenses = () => {
        if (filteredExpenses.length === 0) {
            alert('No expenses available to download for the current filters.');
            return;
        }

        try {
            setIsExporting(true);

            const escapeCsvValue = (value) => {
                const stringValue = String(value ?? '');
                if (/[",\n]/.test(stringValue)) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            };

            const rows = [
                ['Title', 'Category', 'Date', 'Amount', 'Status'],
                ...filteredExpenses.map((expense) => [
                    expense.title,
                    expense.category,
                    expense.date,
                    expense.amount,
                    expense.status || 'pending'
                ])
            ];

            const csvContent = rows
                .map((row) => row.map(escapeCsvValue).join(','))
                .join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const today = new Date().toISOString().split('T')[0];

            link.href = url;
            link.setAttribute('download', `expenses_${dateFilter}_${today}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export expenses:', error);
            alert('Failed to export expenses. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up font-sans text-slate-900">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Expenses</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 text-sm">Manage outflow and operational costs</p>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-400">Last updated: Just now</span>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search expenses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 w-full transition-all"
                        />
                    </div>
                    <button
                        onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-sm font-bold active:scale-95"
                    >
                        <Plus size={18} /> Add Expense
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Total Card */}
                <motion.div
                    whileHover={{ y: -2 }}
                    className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Total Expenses (Feb)</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-black text-slate-900">{formatCurrency(totalStats.total, preferences)}</h2>
                                <span className="inline-flex items-center text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                    <ArrowUpRight size={12} className="mr-0.5" /> +8.2%
                                </span>
                            </div>
                            <p className="text-slate-400 text-xs mt-2 font-medium">vs. {formatCurrency(Math.round(totalStats.total * 0.92), preferences)} last month</p>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <IndianRupee size={24} />
                        </div>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-indigo-50 to-slate-100 rounded-full opacity-50 pointer-events-none" />
                </motion.div>

                {/* Category Summary / Mini Chart replacement */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-4">Top Categories</p>
                        <div className="space-y-4">
                            {categories
                                .map(cat => ({
                                    name: cat,
                                    amount: expenses.filter(e => e.category === cat).reduce((sum, e) => sum + Number(e.amount || 0), 0)
                                }))
                                .sort((a, b) => b.amount - a.amount)
                                .slice(0, 3)
                                .map(catObj => {
                                    const percentage = Math.round((catObj.amount / totalStats.total) * 100) || 0;
                                    const style = getCategoryStyles(catObj.name);
                                    const Icon = style.icon;

                                    return (
                                        <div key={catObj.name} className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg ${style.bg} ${style.text}`}>
                                                <Icon size={14} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-semibold text-slate-700">{catObj.name}</span>
                                                    <span className="text-slate-500 font-medium">{percentage}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${style.bg.replace('bg-', 'bg-').replace('50', '500')}`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Filters (Mobile accessible) & Table */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Desktop Table Header / Filters */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50/30 overflow-hidden">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto">
                        <button
                            onClick={() => setCategoryFilter('all')}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${categoryFilter === 'all'
                                ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
                                : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                }`}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${categoryFilter === cat
                                    ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
                                    : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-600 text-xs font-bold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer hover:border-slate-300 transition-all flex-1 sm:flex-none"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="year">This Year</option>
                        </select>
                        <button
                            onClick={handleDownloadExpenses}
                            disabled={isExporting}
                            title="Download filtered expenses"
                            className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all disabled:opacity-50"
                        >
                            <Download size={18} />
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                    {/* Desktop Table */}
                    <table className="w-full text-left hidden md:table">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-1/3">Description</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <Search size={40} className="mb-3 opacity-20" />
                                            <p className="text-sm font-semibold text-slate-600">No expenses found</p>
                                            <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map((expense) => {
                                    const style = getCategoryStyles(expense.category);
                                    return (
                                        <motion.tr
                                            key={expense.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                    {expense.title}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
                                                    <style.icon size={12} strokeWidth={2.5} />
                                                    {expense.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                                {formatDate(expense.date, preferences)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-bold text-slate-900">{formatCurrency(expense.amount, preferences)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${expense.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                                                    }`}>
                                                    {expense.status === 'paid' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                                    <span className="capitalize">{expense.status}</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {expense.status !== 'paid' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(expense); }}
                                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                            title="Mark as Paid"
                                                        >
                                                            <CheckCircle2 size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openEditModal(expense); }}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4 p-4">
                        {filteredExpenses.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <Search size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm font-medium">No expenses found</p>
                            </div>
                        ) : (
                            filteredExpenses.map((expense) => {
                                const style = getCategoryStyles(expense.category);
                                return (
                                    <motion.div
                                        key={expense.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-3 active:scale-[0.99] transition-transform"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 line-clamp-1">{expense.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5 font-medium">{formatDate(expense.date, preferences)}</p>
                                            </div>
                                            <span className="text-sm font-black text-slate-900">{formatCurrency(expense.amount, preferences)}</span>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                                                <style.icon size={12} strokeWidth={2.5} />
                                                {expense.category}
                                            </span>

                                            <div className="flex items-center gap-2">
                                                {expense.status !== 'paid' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(expense); }}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 bg-slate-50 rounded-lg"
                                                        title="Mark as Paid"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openEditModal(expense)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(expense.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-lg"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>

                    {/* Pagination (Static for now) */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>Showing {filteredExpenses.length} of {expenses.length} records</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm" disabled>Previous</button>
                            <button className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm" disabled>Next</button>
                        </div>
                    </div>
                </div>
                {/* Expense Modal */}
                <AnimatePresence>
                    {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                            >
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {editingExpense ? 'Edit Expense' : 'New Expense'}
                                    </h2>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <form onSubmit={handleSave} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                            placeholder="e.g. Electricity Bill"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                                <input
                                                    type="number"
                                                    required
                                                    min="0"
                                                    value={formData.amount}
                                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                    className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.date}
                                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                            <select
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                            >
                                                <option value="paid">Paid</option>
                                                <option value="pending">Pending</option>
                                                <option value="overdue">Overdue</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                                        >
                                            {editingExpense ? 'Update Expense' : 'Add Expense'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
