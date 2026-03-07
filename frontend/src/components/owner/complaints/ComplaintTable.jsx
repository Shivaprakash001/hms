
import React from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, AlertCircle, ChevronRight, Eye } from 'lucide-react';

const ComplaintTable = ({ complaints, onSelectComplaint }) => {

    if (complaints.length === 0) {
        return (
            <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No complaints found</h3>
                <p className="text-slate-500 mt-1">Good job! Everything seems to be running smoothly.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left hidden md:table">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Complaint</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {complaints.map((complaint) => (
                        <motion.tr
                            key={complaint.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                            onClick={() => onSelectComplaint(complaint)}
                        >
                            <td className="px-6 py-4">
                                <div>
                                    <p className="font-medium text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">{complaint.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{complaint.description}</p>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">{complaint.tenantName}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                            {complaint.room}
                                        </span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                                {new Date(complaint.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${complaint.status === 'resolved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                                    }`}>
                                    {complaint.status === 'resolved' ? <Check size={12} /> : <AlertCircle size={12} />}
                                    <span className="capitalize">{complaint.status}</span>
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                    <ChevronRight size={18} />
                                </button>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4">
                {complaints.map((complaint) => (
                    <motion.div
                        key={complaint.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => onSelectComplaint(complaint)}
                        className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-3 active:scale-[0.99] transition-transform"
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${complaint.status === 'resolved'
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : 'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                        {complaint.status}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {new Date(complaint.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900 mb-0.5 line-clamp-1">{complaint.title}</h4>
                                <p className="text-xs text-slate-500 line-clamp-2">{complaint.description}</p>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                    {complaint.tenantName.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">{complaint.tenantName}</p>
                                    <p className="text-[10px] text-slate-400">Room {complaint.room}</p>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-slate-300" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default ComplaintTable;
