import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Image as ImageIcon, MapPin, Phone, GraduationCap, Building2, BookOpen, Hash, Loader2, CheckCircle2, ShieldCheck, Upload } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Redirect logic on mount
    useEffect(() => {
        if (!user) {
            navigate('/', { replace: true });
        } else if (user.is_profile_completed) {
            navigate('/student/dashboard', { replace: true });
        }
    }, [user, navigate]);

    const handleLoginRefresh = () => {
        window.location.href = '/student/dashboard';
    };

    const [formData, setFormData] = useState({
        name: user?.name || '',
        college_roll_number: '',
        section: '',
        branch: '',
        year_of_study: '1st',
        address: '',
        parent_phone: ''
    });
    const [aadhaarFile, setAadhaarFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                setError('Only image files (JPEG, PNG, WebP) are allowed for Aadhaar upload initially');
                return;
            }
            setAadhaarFile(file);
            setError('');
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!aadhaarFile) {
            setError("Aadhaar Card image is required");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const submitData = new FormData();
            submitData.append('profile_data', JSON.stringify(formData));
            submitData.append('aadhaar_file', aadhaarFile);

            await api.post('/profiles/complete', submitData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setIsSuccess(true);
            setTimeout(() => {
                handleLoginRefresh();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.detail || "Submission failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[500px] relative z-10 py-8"
            >
                <div className="bg-white border border-slate-100 p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <AnimatePresence mode="wait">
                        {isSuccess ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-6"
                            >
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-4">Profile Completed!</h2>
                                <p className="text-slate-500 font-medium mb-8">
                                    Your details have been saved successfully. Redirecting to dashboard...
                                </p>
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                            </motion.div>
                        ) : (
                            <motion.div key="form">
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl mb-6 shadow-xl text-white transform rotate-3">
                                        <User className="w-8 h-8" />
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Complete Your Profile</h1>
                                    <p className="text-slate-500 text-sm font-medium">Please provide your details to continue</p>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 text-center">
                                        {typeof error === 'string' ? error : JSON.stringify(error)}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Full Name *</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <User className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                className="block w-full pl-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm"
                                                placeholder="John Doe"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">College Roll Number *</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Hash className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input
                                                type="text"
                                                name="college_roll_number"
                                                value={formData.college_roll_number}
                                                onChange={handleInputChange}
                                                className="block w-full pl-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm"
                                                placeholder="e.g. 21BCE0001"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Course/Branch</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <BookOpen className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="branch"
                                                    value={formData.branch}
                                                    onChange={handleInputChange}
                                                    className="block w-full pl-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm"
                                                    placeholder="CSE"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Year of Study</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <GraduationCap className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                                </div>
                                                <select
                                                    name="year_of_study"
                                                    value={formData.year_of_study}
                                                    onChange={handleInputChange}
                                                    className="block w-full pl-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm appearance-none"
                                                >
                                                    <option value="1st">1st Year</option>
                                                    <option value="2nd">2nd Year</option>
                                                    <option value="3rd">3rd Year</option>
                                                    <option value="4th">4th Year</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Section</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Building2 className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input
                                                type="text"
                                                name="section"
                                                value={formData.section}
                                                onChange={handleInputChange}
                                                className="block w-full pl-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm"
                                                placeholder="e.g. A"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Address</label>
                                        <div className="relative group">
                                            <div className="absolute top-3 left-0 pl-4 pointer-events-none">
                                                <MapPin className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <textarea
                                                name="address"
                                                value={formData.address}
                                                onChange={handleInputChange}
                                                rows="2"
                                                className="block w-full pl-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm resize-none"
                                                placeholder="Your residential address"
                                            />
                                        </div>
                                    </div>

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
                                                onChange={handleInputChange}
                                                pattern="[0-9]{10}"
                                                className="block w-full pl-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm"
                                                placeholder="10 digit number"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Aadhaar Card Image *</label>
                                        <div className="relative group">
                                            <label className="block w-full cursor-pointer bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-indigo-400 transition-colors">
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                />
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    {previewUrl ? (
                                                        <img src={previewUrl} alt="Preview" className="h-32 object-contain rounded-md" />
                                                    ) : (
                                                        <>
                                                            <Upload className="h-8 w-8 text-slate-400" />
                                                            <span className="text-sm font-medium text-slate-600">Click to upload Aadhaar</span>
                                                            <span className="text-xs text-slate-400">JPG, PNG up to 5MB</span>
                                                        </>
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center py-4 px-4 rounded-xl shadow-lg shadow-indigo-600/25 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-70 mt-4"
                                    >
                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Profile"}
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
