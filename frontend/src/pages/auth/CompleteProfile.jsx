import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, Phone, GraduationCap, Loader2, CheckCircle2, Upload, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tenantService } from '../../api/services';

// Shadcn UI Components
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/Card";

const LogoImage = ({ src }) => {
    const [error, setError] = useState(false);
    if (!src || error) {
        return (
            <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white">
                <ShieldCheck size={24} />
            </div>
        );
    }
    return (
        <img
            src={src}
            alt="Logo"
            className="w-full h-full object-contain p-2"
            onError={() => setError(true)}
        />
    );
};

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) {
            return;
        }
        if (!user) {
            navigate('/', { replace: true });
        } else if (user.is_profile_completed) {
            navigate('/tenant/dashboard', { replace: true });
        }
    }, [user, loading, navigate]);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: '',
        emergency_contact: '',
        personal_email: user?.email || '',
        aadhaar_number: '',
        college_name: '',
        roll_number: '',
        course: '',
        year_of_study: '',
        section: '',
        branch: '',
        address: ''
    });

    const [aadhaarFile, setAadhaarFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        setFormData((prev) => ({
            ...prev,
            name: prev.name || user?.name || '',
            personal_email: prev.personal_email || user?.email || '',
        }));
    }, [user?.name, user?.email]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Loading...</div>;
    }

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
        if (!formData.phone.trim()) return 'Phone number is required';
        if (!formData.emergency_contact.trim()) return 'Parent / Emergency number is required';
        if (!formData.aadhaar_number.trim()) return 'Aadhaar number is required';
        if (formData.aadhaar_number.trim().length !== 12) return 'Aadhaar number must be 12 digits';
        if (!formData.college_name.trim()) return 'College name is required';
        if (!formData.roll_number.trim()) return 'Roll number is required';
        if (!formData.year_of_study) return 'Year of study is required';
        if (!formData.branch.trim()) return 'Branch is required';
        if (!formData.address.trim()) return 'Address is required';
        if (!aadhaarFile) return 'Aadhaar document upload is required';
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
                aadhaar_number: formData.aadhaar_number.trim(),
                college_name: formData.college_name.trim(),
                roll_number: formData.roll_number.trim(),
                course: formData.course?.trim() || null,
                year_of_study: Number(formData.year_of_study),
                section: formData.section?.trim() || null,
                branch: formData.branch.trim(),
                address: formData.address.trim()
            };

            await tenantService.completeMyProfile(payload, aadhaarFile);

            setIsSuccess(true);
            setTimeout(() => {
                window.location.href = '/tenant/dashboard';
            }, 1200);
        } catch (err) {
            const apiError = err?.response?.data?.error;
            const detail = err?.response?.data?.detail;
            let msg = 'Submission failed. Please try again.';
            
            if (apiError?.message) {
                msg = apiError.message;
            } else if (typeof detail === 'object') {
                msg = detail.message;
                if (detail.details) {
                    msg = `${msg}: ${detail.details}`;
                }
            } else if (typeof detail === 'string') {
                msg = detail;
            }
            
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
                className="w-full max-w-[560px] relative z-10 py-8"
            >
                <Card className="border-slate-200 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    
                    <CardContent className="p-8 md:p-10">
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
                                        <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-6 shadow-xl border border-slate-100 overflow-hidden">
                                            <LogoImage src="https://trishul.solutions/logo.png" />
                                        </div>
                                        <CardTitle className="text-3xl font-black tracking-tight text-slate-900 mb-2">Complete Your Profile</CardTitle>
                                        <CardDescription className="text-slate-500 text-sm font-medium">Verify your identity and academic details</CardDescription>
                                    </div>

                                    {error && (
                                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 text-center border border-red-100">{error}</div>
                                    )}

                                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <Label htmlFor="name">Full Name *</Label>
                                            <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="mt-1" />
                                        </div>
                                        
                                        <div>
                                            <Label htmlFor="phone">Phone Number *</Label>
                                            <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="10-digit number" className="mt-1" />
                                        </div>
                                        
                                        <div>
                                            <Label htmlFor="emergency_contact">Emergency Contact *</Label>
                                            <Input id="emergency_contact" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} placeholder="Parent/Guardian" className="mt-1" />
                                        </div>

                                        <div className="md:col-span-2">
                                            <Label htmlFor="aadhaar_number">Aadhaar Number *</Label>
                                            <Input id="aadhaar_number" name="aadhaar_number" value={formData.aadhaar_number} onChange={handleInputChange} placeholder="12-digit number" className="mt-1" />
                                        </div>

                                        <div className="md:col-span-2">
                                            <Label htmlFor="personal_email">Personal Email</Label>
                                            <Input id="personal_email" name="personal_email" type="email" value={formData.personal_email} onChange={handleInputChange} className="mt-1" />
                                        </div>

                                        <div className="md:col-span-2 space-y-4 pt-2">
                                            <div className="h-px bg-slate-100 w-full" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Academic Information</p>
                                        </div>

                                        <div className="md:col-span-2">
                                            <Label htmlFor="college_name">College Name *</Label>
                                            <Input id="college_name" name="college_name" value={formData.college_name} onChange={handleInputChange} className="mt-1" />
                                        </div>

                                        <div>
                                            <Label htmlFor="roll_number">Roll Number *</Label>
                                            <Input id="roll_number" name="roll_number" value={formData.roll_number} onChange={handleInputChange} className="mt-1" />
                                        </div>

                                        <div>
                                            <Label htmlFor="course">Course</Label>
                                            <Input id="course" name="course" value={formData.course} onChange={handleInputChange} className="mt-1" />
                                        </div>

                                        <div>
                                            <Label htmlFor="year_of_study">Year of Study *</Label>
                                            <Input id="year_of_study" name="year_of_study" type="number" min="1" max="6" value={formData.year_of_study} onChange={handleInputChange} className="mt-1" />
                                        </div>

                                        <div>
                                            <Label htmlFor="branch">Branch *</Label>
                                            <Input id="branch" name="branch" value={formData.branch} onChange={handleInputChange} className="mt-1" />
                                        </div>

                                        <div className="md:col-span-2">
                                            <Label htmlFor="address">Permanent Address *</Label>
                                            <Input id="address" name="address" value={formData.address} onChange={handleInputChange} className="mt-1" />
                                        </div>

                                        <div className="md:col-span-2 space-y-2 pt-2">
                                            <Label>Aadhaar Document *</Label>
                                            <label className="block w-full cursor-pointer bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 hover:bg-slate-100 hover:border-indigo-400 transition-all text-center">
                                                <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    {previewUrl ? (
                                                        <img src={previewUrl} alt="Preview" className="h-32 object-contain rounded-lg shadow-sm" />
                                                    ) : (
                                                        <>
                                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-1">
                                                                <Upload className="h-6 w-6 text-indigo-600" />
                                                            </div>
                                                            <span className="text-sm font-bold text-slate-700">Upload Aadhaar Copy</span>
                                                            <span className="text-xs text-slate-400">PDF, JPG or PNG (max 5MB)</span>
                                                        </>
                                                    )}
                                                    {aadhaarFile && !previewUrl && (
                                                        <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-full">{aadhaarFile.name}</span>
                                                    )}
                                                </div>
                                            </label>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                            className="md:col-span-2 w-full h-12 shadow-xl shadow-indigo-600/20 text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99] mt-4"
                                        >
                                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit & Complete Registration'}
                                        </Button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
};

export default CompleteProfile;
