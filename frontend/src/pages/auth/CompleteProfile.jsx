import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, Phone, GraduationCap, Loader2, CheckCircle2, Upload, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../api/services';

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            navigate('/', { replace: true });
        } else if (user.is_profile_completed) {
            navigate('/student/dashboard', { replace: true });
        }
    }, [user, navigate]);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: '',
        emergency_contact: '',
        personal_email: user?.email || '',
        college_name: '',
        branch: '',
        permanent_address: '',
        temporary_address: ''
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
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setError('File size must be less than 5MB');
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
            setError('Only JPG, PNG, WebP, or PDF files are allowed');
            return;
        }

        setAadhaarFile(file);
        setError('');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result);
            reader.readAsDataURL(file);
        } else {
            setPreviewUrl('');
        }
    };

    const validateRequired = () => {
        if (!formData.name.trim()) return 'Full name is required';
        if (!formData.phone.trim()) return 'Phone is required';
        if (!formData.emergency_contact.trim()) return 'Parent/Emergency phone is required';
        if (!formData.college_name.trim()) return 'College is required';
        if (!formData.branch.trim()) return 'Branch is required';
        if (!formData.temporary_address.trim() && !formData.permanent_address.trim()) {
            return 'At least one address is required';
        }
        if (!aadhaarFile) return 'Aadhaar document is required';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationError = validateRequired();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const payload = {
                name: formData.name.trim(),
                phone: formData.phone.trim(),
                emergency_contact: formData.emergency_contact.trim(),
                phone_1: formData.phone.trim(),
                phone_2: formData.emergency_contact.trim(),
                personal_email: formData.personal_email?.trim() || null,
                college_name: formData.college_name.trim(),
                branch: formData.branch.trim(),
                permanent_address: formData.permanent_address?.trim() || null,
                temporary_address: formData.temporary_address?.trim() || null
            };

            await studentService.completeMyProfile(payload, aadhaarFile);

            setIsSuccess(true);
            setTimeout(() => {
                window.location.href = '/student/dashboard';
            }, 1200);
        } catch (err) {
            const detail = err?.response?.data?.detail;
            const msg = typeof detail === 'object' ? detail?.message : detail;
            setError(msg || err.message || 'Submission failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[520px] relative z-10 py-8"
            >
                <div className="bg-white border border-slate-100 p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <AnimatePresence mode="wait">
                        {isSuccess ? (
                            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-4">Profile Completed!</h2>
                                <p className="text-slate-500 font-medium mb-6">Redirecting to dashboard...</p>
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                            </motion.div>
                        ) : (
                            <motion.div key="form">
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl mb-6 shadow-xl text-white transform rotate-3">
                                        <User className="w-8 h-8" />
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Complete Your Profile</h1>
                                    <p className="text-slate-500 text-sm font-medium">Uses the same fields as Student Profile</p>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 text-center">{error}</div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <Field icon={User} label="Full Name *" name="name" value={formData.name} onChange={handleInputChange} />
                                    <Field icon={Phone} label="Phone *" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="10-15 digit number" />
                                    <Field icon={Phone} label="Parent / Emergency Contact *" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} placeholder="10-15 digit number" />
                                    <Field icon={Mail} label="Personal Email" name="personal_email" value={formData.personal_email} onChange={handleInputChange} type="email" />
                                    <Field icon={GraduationCap} label="College *" name="college_name" value={formData.college_name} onChange={handleInputChange} />
                                    <Field icon={GraduationCap} label="Branch *" name="branch" value={formData.branch} onChange={handleInputChange} />
                                    <Field icon={MapPin} label="Temporary Address *" name="temporary_address" value={formData.temporary_address} onChange={handleInputChange} />
                                    <Field icon={MapPin} label="Permanent Address" name="permanent_address" value={formData.permanent_address} onChange={handleInputChange} />

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Aadhaar Document *</label>
                                        <label className="block w-full cursor-pointer bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-indigo-400 transition-colors">
                                            <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                {previewUrl ? (
                                                    <img src={previewUrl} alt="Preview" className="h-28 object-contain rounded-md" />
                                                ) : (
                                                    <>
                                                        <Upload className="h-8 w-8 text-slate-400" />
                                                        <span className="text-sm font-medium text-slate-600">Click to upload Aadhaar</span>
                                                        <span className="text-xs text-slate-400">JPG, PNG, WebP or PDF up to 5MB</span>
                                                    </>
                                                )}
                                                {aadhaarFile && !previewUrl && (
                                                    <span className="text-xs text-slate-600 font-medium">{aadhaarFile.name}</span>
                                                )}
                                            </div>
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center py-4 px-4 rounded-xl shadow-lg shadow-indigo-600/25 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-70 mt-2"
                                    >
                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Profile'}
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

function Field({ icon: Icon, label, name, value, onChange, placeholder, type = 'text' }) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">{label}</label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Icon className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="block w-full pl-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm"
                />
            </div>
        </div>
    );
}

export default CompleteProfile;
