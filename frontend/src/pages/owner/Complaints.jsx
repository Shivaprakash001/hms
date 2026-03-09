
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { complaintService } from '../../api/services';

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
        loadComplaints();
    }, []);

    const loadComplaints = async () => {
        try {
            setIsLoading(true);
            const response = await complaintService.getAll();
            // Backend returns { complaints: [], total: ... }
            setComplaints(response.complaints || []);
        } catch (error) {
            console.error("Failed to load complaints:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Derived State: Filtered Complaints
    const filteredComplaints = useMemo(() => {
        return complaints.filter(complaint => {
            // Backend student name might be nested in 'student' object or not present if my schema implies it
            // ComplaintResponse has `student: Optional[dict]`.
            // We need to map it if the table expects 'tenantName'. 
            // Better to map it on load or adapt here.
            // Let's adapt here.
            const tenantName = complaint.student?.profiles?.name || complaint.student?.name || 'Unknown';
            const roomNo = complaint.student?.current_room?.room_no || 'N/A';

            const matchesSearch = tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                roomNo.includes(searchTerm) ||
                complaint.title.toLowerCase().includes(searchTerm.toLowerCase());

            // Backend Status is UPPERCASE. Filter is usually lowercase usage in UI.
            // Let's compare case-insensitively.
            const matchesStatus = statusFilter === 'all' || complaint.status.toLowerCase() === statusFilter.toLowerCase();
            return matchesSearch && matchesStatus;
        });
    }, [complaints, searchTerm, statusFilter]);

    // Derived State: Stats
    const stats = useMemo(() => {
        const total = complaints.length;
        const pending = complaints.filter(c => c.status === 'PENDING').length;
        const resolved = complaints.filter(c => c.status === 'RESOLVED').length;
        return { total, pending, resolved };
    }, [complaints]);

    // Handlers
    const handleResolve = async (id) => {
        try {
            // Optimistic update or wait? Let's wait for simplicity
            await complaintService.updateStatus(id, 'RESOLVED', 'Resolved by owner');

            // Update local state
            setComplaints(prev => prev.map(c =>
                c.id === id ? { ...c, status: 'resolved' } : c
            ));

            if (selectedComplaint && selectedComplaint.id === id) {
                setSelectedComplaint({ ...selectedComplaint, status: 'resolved' });
            }
        } catch (error) {
            console.error("Failed to resolve complaint:", error);
            alert("Failed to update status");
        }
    };

    const handleDelete = (id) => {
        alert("Deletion is not supported for tracking purposes. Please mark as Resolved or Rejected.");
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
