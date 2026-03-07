import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Clock, CheckCircle } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { complaintService } from '../../api/services';

const StudentComplaints = () => {
    const { user } = useAuth();
    const [complaints, setComplaints] = React.useState([]);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [newComplaint, setNewComplaint] = React.useState({
        title: '',
        category: 'Maintenance',
        description: '',
        priority: 'Medium'
    });

    React.useEffect(() => {
        if (user) {
            loadComplaints();
        }
    }, [user]);

    const loadComplaints = async () => {
        try {
            setIsLoading(true);
            // Pass student_id if available to filter. 
            // If user is student, backend might use the token user_id (which is profile_id usually).
            // But ComplaintCreate requires student_id.
            // Let's assume user.student_id exists or we pass profile_id and backend handles mapping?
            // Usually auth service returns user info including student_id if applicable.
            // For now, let's just call getAll(). The backend should filter for students based on token role anyway hopefully.
            // Or we check if user has student_id.
            const params = {};
            if (user.student_id) {
                params.student_id = user.student_id;
            }
            const response = await complaintService.getAll(params);
            setComplaints(response.complaints || []);
        } catch (error) {
            console.error("Failed to load complaints:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewComplaint(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user.student_id) {
            alert("Error: Student ID not found. Please log in again.");
            return;
        }

        const complaintData = {
            student_id: user.student_id,
            title: newComplaint.title,
            description: newComplaint.description,
            category: newComplaint.category.toUpperCase(), // Backend expects uppercase Enum
            priority: newComplaint.priority.toUpperCase()
        };

        try {
            await complaintService.create(complaintData);

            // Notification logic (if backend handles it, great. If frontend needs to trigger, we can keep it but usually backend does it)
            // For now, I'll remove the local storage notification.

            // Refresh list
            loadComplaints();

            setIsModalOpen(false);
            setNewComplaint({
                title: '',
                category: 'Maintenance',
                description: '',
                priority: 'Medium'
            });
            alert("Complaint submitted successfully!");
        } catch (error) {
            console.error("Failed to submit complaint:", error);
            alert("Failed to submit complaint. Please try again.");
        }
    };

    return (
        <div className="space-y-6 relative">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Complaints & Requests</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                >
                    <Plus size={18} />
                    New Complaint
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {complaints.length > 0 ? (
                    complaints.map((item) => (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={item.id}
                            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                    item.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                    {item.status}
                                </span>
                                <span className="text-xs text-slate-400">{item.date}</span>
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                            <p className="text-sm text-slate-500 mb-4">Category: {item.category}</p>

                            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400 font-medium">
                                {item.status === 'Pending' ? (
                                    <>
                                        <Clock size={14} /> Estimated resolution: 24 hrs
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={14} className="text-green-500" />
                                        {item.status === 'resolved' ? 'Resolved' : 'Status Updated'}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="col-span-full text-center py-12 text-slate-400">
                        <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No complaints found. Have something to report?</p>
                    </div>
                )}
            </div>

            {/* New Complaint Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900">New Complaint</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    name="title"
                                    required
                                    value={newComplaint.title}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    placeholder="Brief title of the issue"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                    <select
                                        name="category"
                                        value={newComplaint.category}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    >
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Plumbing">Plumbing</option>
                                        <option value="Electrical">Electrical</option>
                                        <option value="WiFi">WiFi</option>
                                        <option value="Noise">Noise</option>
                                        <option value="Cleaning">Cleaning</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                    <select
                                        name="priority"
                                        value={newComplaint.priority}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    name="description"
                                    required
                                    rows="4"
                                    value={newComplaint.description}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                                    placeholder="Describe the issue in detail..."
                                ></textarea>
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
                                    Submit Complaint
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default StudentComplaints;
