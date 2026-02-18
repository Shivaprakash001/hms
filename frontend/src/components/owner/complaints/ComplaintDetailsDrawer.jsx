
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Trash2, Calendar, User, Layout, MessageSquare, AlertTriangle } from 'lucide-react';

const ComplaintDetailsDrawer = ({ isOpen, onClose, complaint, onResolve, onDelete }) => {
    if (!isOpen || !complaint) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                />

                {/* Drawer */}
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-md h-full bg-white shadow-2xl p-6 overflow-y-auto border-l border-slate-100 flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Complaint Details</span>
                            <h2 className="text-xl font-bold text-slate-900 mt-1">Issue #{complaint.id.split('_')[1]}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Status Banner */}
                    <div className={`p-4 rounded-xl border mb-6 flex items-start gap-3 ${complaint.status === 'resolved'
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                        : 'bg-amber-50 border-amber-100 text-amber-800'
                        }`}>
                        {complaint.status === 'resolved' ? <CheckCircle2 className="shrink-0 mt-0.5" size={20} /> : <AlertTriangle className="shrink-0 mt-0.5" size={20} />}
                        <div>
                            <p className="font-bold text-sm">Status: {complaint.status === 'resolved' ? 'Resolved' : 'Pending Action'}</p>
                            <p className="text-xs mt-1 opacity-80">
                                {complaint.status === 'resolved'
                                    ? 'This issue has been marked as fixed.'
                                    : 'This issue currently requires your attention.'}
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-6 flex-1">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{complaint.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                {complaint.description}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 border border-slate-100 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                    <User size={14} />
                                    <span className="text-xs font-medium">Tenant</span>
                                </div>
                                <p className="font-semibold text-slate-900 text-sm">{complaint.tenantName}</p>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                    <Layout size={14} />
                                    <span className="text-xs font-medium">Room</span>
                                </div>
                                <p className="font-semibold text-slate-900 text-sm">{complaint.room}</p>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                    <Calendar size={14} />
                                    <span className="text-xs font-medium">Date</span>
                                </div>
                                <p className="font-semibold text-slate-900 text-sm">{complaint.date}</p>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                    <MessageSquare size={14} />
                                    <span className="text-xs font-medium">Priority</span>
                                </div>
                                <p className={`font-semibold text-sm capitalize ${complaint.priority === 'high' ? 'text-rose-600' : 'text-slate-900'
                                    }`}>{complaint.priority || 'Normal'}</p>
                            </div>
                        </div>

                        {/* Activity Log Placeholder */}
                        <div>
                            <h4 className="font-bold text-sm text-slate-900 mb-3">Activity</h4>
                            <div className="border-l-2 border-slate-100 pl-4 space-y-4">
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
                                    <p className="text-xs text-slate-500">Today, 10:23 AM</p>
                                    <p className="text-sm text-slate-700 mt-0.5">Ticket viewed by Owner</p>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                                    <p className="text-xs text-slate-500">{new Date(complaint.date).toLocaleDateString()}</p>
                                    <p className="text-sm text-slate-700 mt-0.5">Complaint submitted by {complaint.tenantName}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 mt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                        {complaint.status !== 'resolved' && (
                            <button
                                onClick={() => onResolve(complaint.id)}
                                className="col-span-2 flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                            >
                                <CheckCircle2 size={18} /> Mark as Resolved
                            </button>
                        )}

                        <button className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium transition-colors">
                            Add Note
                        </button>
                        <button
                            onClick={() => onDelete(complaint.id)}
                            className="flex items-center justify-center gap-2 py-2.5 border border-red-100 hover:bg-red-50 text-red-600 rounded-xl font-medium transition-colors"
                        >
                            <Trash2 size={18} /> Delete
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ComplaintDetailsDrawer;
