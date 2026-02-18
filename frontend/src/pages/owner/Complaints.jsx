
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock Data
import { getComplaints, updateComplaintStatus, deleteComplaint } from '../../utils/storageUtils';

// Components
import ComplaintStatsCard from '../../components/owner/complaints/ComplaintStatsCard';
import ComplaintTable from '../../components/owner/complaints/ComplaintTable';
import ComplaintDetailsDrawer from '../../components/owner/complaints/ComplaintDetailsDrawer';

const Complaints = () => {
    const [complaints, setComplaints] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedComplaint, setSelectedComplaint] = useState(null);

    // Initial Data Load
    useEffect(() => {
        // Simulate API call
        setTimeout(() => {
            const data = getComplaints();
            setComplaints(data);
            setIsLoading(false);
        }, 600);
    }, []);

    // Derived State: Filtered Complaints
    const filteredComplaints = useMemo(() => {
        return complaints.filter(complaint => {
            const matchesSearch = complaint.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                complaint.room.includes(searchTerm) ||
                complaint.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || complaint.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [complaints, searchTerm, statusFilter]);

    // Derived State: Stats
    const stats = useMemo(() => {
        const total = complaints.length;
        const pending = complaints.filter(c => c.status === 'Pending').length;
        const resolved = complaints.filter(c => c.status === 'resolved').length;
        return { total, pending, resolved };
    }, [complaints]);

    // Handlers
    const handleResolve = (id) => {
        // Optimistic update
        const updatedList = updateComplaintStatus(id, 'resolved');
        setComplaints(updatedList);

        if (selectedComplaint && selectedComplaint.id === id) {
            setSelectedComplaint({ ...selectedComplaint, status: 'resolved' });
        }
    };


    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this complaint?')) {
            const updatedList = deleteComplaint(id);
            setComplaints(updatedList);
            if (selectedComplaint && selectedComplaint.id === id) {
                setSelectedComplaint(null);
            }
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Complaints</h1>
                    <p className="text-slate-500">Track and resolve tenant issues</p>
                </div>
                {/* Optional: Add 'Create Complaint' button if owner needs to log one manually */}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ComplaintStatsCard
                    title="Total Issues"
                    value={stats.total}
                    icon={AlertCircle}
                    type="neutral"
                    subtext="All reported issues"
                />
                <ComplaintStatsCard
                    title="Pending"
                    value={stats.pending}
                    icon={Clock}
                    type={stats.pending > 0 ? "warning" : "success"}
                    subtext={stats.pending > 0 ? "Requires attention" : "All cleared!"}
                />
                <ComplaintStatsCard
                    title="Resolved"
                    value={stats.resolved}
                    icon={CheckCircle2}
                    type="success"
                    subtext="Successfully closed"
                />
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Filter Bar */}
                <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/30">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search issues, tenants..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-slate-400 hover:border-slate-300"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            {['all', 'pending', 'resolved'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${statusFilter === status
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <ComplaintTable
                    complaints={filteredComplaints}
                    onSelectComplaint={setSelectedComplaint}
                />

                {/* Pagination - Static for now */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50/30">
                    <span>Showing {filteredComplaints.length} results</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-xs font-medium" disabled>Previous</button>
                        <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-xs font-medium" disabled>Next</button>
                    </div>
                </div>
            </div>

            {/* Details Drawer */}
            <ComplaintDetailsDrawer
                isOpen={!!selectedComplaint}
                onClose={() => setSelectedComplaint(null)}
                complaint={selectedComplaint}
                onResolve={handleResolve}
                onDelete={handleDelete}
            />
        </div>
    );
};

export default Complaints;
