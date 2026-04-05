import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, User, UserSquare2, Home, Phone, MapPin, Building2, BookOpen, UploadCloud, Image as ImageIcon, X } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [formData, setFormData] = useState({
        name: user?.name || '',
        college_roll_number: '',
        section: '',
        branch: '',
        year_of_study: '',
        address: '',
        parent_phone: ''
    });
    const [aadhaarFile, setAadhaarFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    
    const fileInputRef = useRef(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }
            if (!file.type.startsWith('image/')) {
                setError('Please upload an image file');
                return;
            }
            setAadhaarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError('');
        }
    };

    const removeFile = () => {
        setAadhaarFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!aadhaarFile) {
            setError('Please upload your Aadhaar card image');
            return;
        }

        const phoneRegex = /^\+?\d{10,15}$/;
        if (!phoneRegex.test(formData.parent_phone)) {
            setError('Please enter a valid 10-15 digit phone number');
            return;
        }

        setIsLoading(true);

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key]) data.append(key, formData[key]);
            });
            data.append('aadhaar_file', aadhaarFile);

            await api.post('/profiles/complete', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            setIsSuccess(true);
            setTimeout(() => {
                window.location.href = '/student/dashboard';
            }, 2000);
            
        } catch (err) {
            setError(err.response?.data?.detail?.message || err.response?.data?.detail || "Failed to complete profile.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-slate-50 to-slate-100/50" />
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-3xl relative z-10"
            >
                <div className="bg-white border border-slate-100 p-8 md:p-10 rounded-[2rem] shadow-2xl shadow-indigo-100/50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    
                    <AnimatePresence mode="wait">
                        {isSuccess ? (
                            <motion.div 
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-16"
                            >
                                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                                    <CheckCircle2 size={48} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-4">Profile Completed!</h2>
                                <p className="text-slate-500 font-medium mb-8">
                                    Your details have been saved securely. Redirecting to dashboard...
                                </p>
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                            </motion.div>
                        ) : (
                            <motion.div key="form">
                                <div className="text-center mb-10">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl mb-6 shadow-xl shadow-indigo-200 text-white transform -rotate-3">
                                        <UserSquare2 className="w-8 h-8" />
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Complete Profile</h1>
                                    <p className="text-slate-500 font-medium">Please provide your details to access the dashboard</p>
                                </div>

                                {error && (
                                    <div className="bg-red-50/80 border border-red-100 text-red-600 p-4 rounded-xl text-sm font-semibold mb-8 text-center flex items-center justify-center gap-2">
                                        <X size={16} />
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Name */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Full Name</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <User className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                                                    placeholder="John Doe"
                                                />
                                            </div>
                                        </div>

                                        {/* Roll Number */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">College Roll Number *</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <BookOpen className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="college_roll_number"
                                                    value={formData.college_roll_number}
                                                    onChange={handleChange}
                                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                                                    placeholder="e.g. 21BQA01"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Branch */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Course / Branch</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <Building2 className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="branch"
                                                    value={formData.branch}
                                                    onChange={handleChange}
                                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                                                    placeholder="e.g. Computer Science"
                                                />
                                            </div>
                                        </div>

                                        {/* Section & Year Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Section</label>
                                                <input
                                                    type="text"
                                                    name="section"
                                                    value={formData.section}
                                                    onChange={handleChange}
                                                    className="block w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                                                    placeholder="e.g. A"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Year</label>
                                                <select
                                                    name="year_of_study"
                                                    value={formData.year_of_study}
                                                    onChange={handleChange}
                                                    className="block w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                                                >
                                                    <option value="">Select</option>
                                                    <option value="1st Year">1st Year</option>
                                                    <option value="2nd Year">2nd Year</option>
                                                    <option value="3rd Year">3rd Year</option>
                                                    <option value="4th Year">4th Year</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Parent Phone */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Parent Phone *</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                                </div>
                                                <input
                                                    type="tel"
                                                    name="parent_phone"
                                                    value={formData.parent_phone}
                                                    onChange={handleChange}
                                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                                                    placeholder="10-digit number"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Residential Address *</label>
                                            <div className="relative group">
                                                <div className="absolute top-4 left-0 pl-4 pointer-events-none">
                                                    <MapPin className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                                </div>
                                                <textarea
                                                    name="address"
                                                    value={formData.address}
                                                    onChange={handleChange}
                                                    rows="2"
                                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all resize-none font-medium"
                                                    placeholder="Full residential address"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Aadhaar Upload Component */}
                                    <div className="pt-4 border-t border-slate-100">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider mb-2 block">Aadhaar Card Upload *</label>
                                        
                                        {!previewUrl ? (
                                            <div 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 transition-all rounded-2xl p-8 text-center cursor-pointer group"
                                            >
                                                <div className="w-16 h-16 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                                    <UploadCloud className="w-8 h-8 text-indigo-500" />
                                                </div>
                                                <p className="text-slate-700 font-bold mb-1">Click to upload Aadhaar</p>
                                                <p className="text-slate-400 text-sm">JPG, PNG or WEBP (max 5MB)</p>
                                            </div>
                                        ) : (
                                            <div className="relative  rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                                                <img src={previewUrl} alt="Aadhaar Preview" className="w-full h-48 object-cover opacity-90" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <button 
                                                        type="button"
                                                        onClick={removeFile}
                                                        className="px-4 py-2 bg-white text-red-600 rounded-xl font-bold flex items-center gap-2 shadow-lg"
                                                    >
                                                        <X size={18} /> Remove File
                                                    </button>
                                                </div>
                                                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                                                    <ImageIcon size={16} />
                                                    {aadhaarFile?.name}
                                                </div>
                                            </div>
                                        )}
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden" 
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center py-4 px-4 rounded-xl shadow-lg shadow-indigo-600/25 text-[15px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-70 mt-8"
                                    >
                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Profile & Continue"}
                                    </button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default CompleteProfile;
