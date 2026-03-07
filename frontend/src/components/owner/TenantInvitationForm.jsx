import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Home, Loader2, Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../api/axios';

const TenantInvitationForm = ({ isOpen, onClose, onInviteSuccess }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [roomId, setRoomId] = useState('');
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchRooms();
        }
    }, [isOpen]);

    const fetchRooms = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/rooms?grouped=false');
            setRooms(response.data || []);
        } catch (err) {
            console.error("Failed to fetch rooms:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const response = await api.post('/students/invite', {
                name,
                email,
                room_id: roomId
            });
            setSuccessData(response.data);
            if (onInviteSuccess) onInviteSuccess(response.data);
        } catch (err) {
            setError(err.response?.data?.detail?.message || "Failed to send invitation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Invite New Tenant</h2>
                        <p className="text-sm text-slate-500 font-medium">Send an activation link to a student</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm border border-transparent hover:border-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {successData ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-4"
                            >
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Invitation Sent!</h3>
                                <p className="text-slate-500 font-medium mb-6">
                                    Invitation email has been triggered for <b>{email}</b>.
                                </p>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left mb-8">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Manual Activation Link (For Testing)</p>
                                    <p className="text-xs font-mono break-all text-indigo-600 bg-white p-2 rounded border border-slate-100">
                                        {successData.activation_link}
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    Done
                                </button>
                            </motion.div>
                        ) : (
                            <motion.form key="form" onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <div className="flex items-start gap-3 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
                                        <AlertCircle className="shrink-0" size={18} />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Full Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                                            placeholder="John Doe"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Email Address</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                                            placeholder="john@example.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Assign Room</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Home className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        </div>
                                        <select
                                            value={roomId}
                                            onChange={(e) => setRoomId(e.target.value)}
                                            className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium appearance-none"
                                            required
                                        >
                                            <option value="">Select a room</option>
                                            {rooms.map(room => (
                                                <option key={room.id} value={room.id}>
                                                    Room {room.room_number} ({room.type || 'Standard'}) - {room.status}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || isLoading}
                                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl shadow-xl shadow-indigo-600/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 mt-4"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Send size={18} />
                                            Send Invitation
                                        </>
                                    )}
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default TenantInvitationForm;
