import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, UserX, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { tenantService } from '../../../api/services';

const ReactivateForm = ({ request, onConfirm, onCancel, loading }) => {
    const today = new Date().toISOString().split('T')[0];
    const [rent, setRent] = useState(String(request.tenant_rent || ''));
    const [joinedOn, setJoinedOn] = useState(today);
    const [notes, setNotes] = useState('');

    return (
        <div className="mt-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Confirm Rejoin Details</p>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Monthly Rent (₹)</label>
                    <input
                        type="number"
                        min="0"
                        value={rent}
                        onChange={e => setRent(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
                        placeholder="e.g. 5000"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Joined On</label>
                    <input
                        type="date"
                        value={joinedOn}
                        onChange={e => setJoinedOn(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Note (optional)</label>
                <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
                    placeholder="e.g. Rejoining for new academic year"
                />
            </div>
            <div className="flex gap-2 pt-1">
                <button
                    disabled={loading || !rent || !joinedOn}
                    onClick={() => onConfirm({ rent: parseFloat(rent), joinedOn, notes })}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-all"
                >
                    {loading ? 'Processing…' : 'Confirm Rejoin'}
                </button>
                <button
                    disabled={loading}
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

const RequestRow = ({ req, onApproved, onRejected }) => {
    const [showForm, setShowForm] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');

    const handleApprove = async ({ rent, joinedOn, notes }) => {
        setActionLoading(true);
        setError('');
        try {
            await tenantService.reactivate(req.tenant_id, {
                monthly_rent: rent,
                joined_on: joinedOn,
            });
            await tenantService.decideReactivationRequest(req.id, 'approve', notes);
            onApproved(req.id);
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to approve');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!window.confirm(`Decline rejoin request from ${req.tenant_name}?`)) return;
        setActionLoading(true);
        setError('');
        try {
            await tenantService.decideReactivationRequest(req.id, 'reject');
            onRejected(req.id);
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to reject');
        } finally {
            setActionLoading(false);
        }
    };

    const daysAgo = req.created_at
        ? Math.floor((Date.now() - new Date(req.created_at).getTime()) / 86400000)
        : null;

    return (
        <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{req.tenant_name}</span>
                        {req.room_no && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-bold">
                                Room {req.room_no}
                            </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[11px] font-bold uppercase">
                            {req.current_status}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        {req.tenant_phone || req.tenant_email || ''}
                        {daysAgo !== null && (
                            <span className="ml-2 text-slate-300">·</span>
                        )}
                        {daysAgo === 0 ? ' Today' : daysAgo === 1 ? ' Yesterday' : daysAgo != null ? ` ${daysAgo}d ago` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        disabled={actionLoading}
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50"
                    >
                        <UserCheck size={13} />
                        Approve
                        {showForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                        disabled={actionLoading}
                        onClick={handleReject}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all disabled:opacity-50"
                    >
                        <UserX size={13} />
                        Decline
                    </button>
                </div>
            </div>

            {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                    >
                        <ReactivateForm
                            request={req}
                            loading={actionLoading}
                            onConfirm={handleApprove}
                            onCancel={() => setShowForm(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const ReactivationRequestsPanel = ({ onTenantReactivated }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const data = await tenantService.getReactivationRequests();
            const pending = (Array.isArray(data) ? data : []).filter(r => r.status === 'PENDING');
            setRequests(pending);
        } catch {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const removeRequest = useCallback((id) => {
        setRequests(prev => prev.filter(r => r.id !== id));
    }, []);

    const handleApproved = useCallback((id) => {
        removeRequest(id);
        onTenantReactivated?.();
    }, [removeRequest, onTenantReactivated]);

    if (loading) return null;
    if (requests.length === 0) return null;

    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden">
            <button
                onClick={() => setCollapsed(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-amber-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                        <Clock size={16} className="text-amber-600" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-slate-800">
                            Rejoin Requests
                            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                                {requests.length}
                            </span>
                        </p>
                        <p className="text-xs text-slate-500">Former tenants requesting to rejoin your hostel</p>
                    </div>
                </div>
                {collapsed ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
            </button>

            <AnimatePresence>
                {!collapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 space-y-3">
                            {requests.map(req => (
                                <RequestRow
                                    key={req.id}
                                    req={req}
                                    onApproved={handleApproved}
                                    onRejected={removeRequest}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
