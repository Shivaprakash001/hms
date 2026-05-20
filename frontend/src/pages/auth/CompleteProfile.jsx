import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, Phone, GraduationCap, Loader2, CheckCircle2, Briefcase, ChevronRight, ChevronLeft, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tenantService } from '../../api/services';

// Shadcn UI Components
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/Card";
import { indianPhoneDigits, normalizeIndianPhone } from '@/lib/phone';

const SlideVariant = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
};

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);

    // Check Auth State
    useEffect(() => {
        if (loading) return;
        if (!user) navigate('/', { replace: true });
        else if (user.is_profile_completed) navigate('/tenant/dashboard', { replace: true });
    }, [user, loading, navigate]);

    // Form State
    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: '',
        emergency_contact: '',
        personal_email: user?.email || '',
        gender: '',
        date_of_birth: '',
        temporary_address: '',
        permanent_address: '',

        profile_type: '', // STUDENT or WORKING_PROFESSIONAL

        // Student Fields
        college_name: '',
        roll_number: '',
        course: '',
        year_of_study: '',
        section: '',
        branch: '',

        // Work Fields
        office_name: '',
        office_location: '',
        job_role: '',
    });

    const [profilePhotoFile, setProfilePhotoFile] = useState(null);
    const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPrefilling, setIsPrefilling] = useState(true);
    const [onboardingSettings, setOnboardingSettings] = useState({
        require_profile_photo_onboarding: false,
        require_phone_otp_onboarding: false,
    });
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);


    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            name: prev.name || user?.name || '',
            personal_email: prev.personal_email || user?.email || '',
        }));
    }, [user]);

    useEffect(() => {
        if (!user) return;
        let mounted = true;

        tenantService.getMyOnboardingSettings()
            .then((settings) => {
                if (!mounted) return;
                const defaults = settings?.invited_defaults || {};
                setOnboardingSettings({
                    require_profile_photo_onboarding: Boolean(settings?.require_profile_photo_onboarding),
                    require_phone_otp_onboarding: Boolean(settings?.require_phone_otp_onboarding),
                });
                setFormData(prev => ({
                    ...prev,
                    name: prev.name || defaults.name || user?.name || '',
                    phone: prev.phone || defaults.phone || '',
                    emergency_contact: prev.emergency_contact || defaults.emergency_contact || '',
                    personal_email: prev.personal_email || defaults.personal_email || user?.email || '',
                    gender: prev.gender || defaults.gender || '',
                    date_of_birth: prev.date_of_birth || defaults.date_of_birth || '',
                    temporary_address: prev.temporary_address || defaults.temporary_address || '',
                    permanent_address: prev.permanent_address || defaults.permanent_address || '',
                    profile_type: prev.profile_type || defaults.profile_type || '',
                    college_name: prev.college_name || defaults.college_name || '',
                    roll_number: prev.roll_number || defaults.roll_number || '',
                    course: prev.course || defaults.course || '',
                    year_of_study: prev.year_of_study || defaults.year_of_study || '',
                    section: prev.section || defaults.section || '',
                    branch: prev.branch || defaults.branch || '',
                    office_name: prev.office_name || defaults.office_name || '',
                    office_location: prev.office_location || defaults.office_location || '',
                    job_role: prev.job_role || defaults.job_role || '',
                }));
            })
            .catch(() => {})
            .finally(() => {
                if (mounted) setIsPrefilling(false);
            });

        return () => { mounted = false; };
    }, [user]);



    if (loading || isPrefilling) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Loading...</div>;

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            setFormData(prev => ({ ...prev, phone: indianPhoneDigits(value) }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleProfilePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return setError('Profile photo size must be < 2MB');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Profile photo must be JPG, PNG, or WEBP');

        setProfilePhotoFile(file);
        setError('');
        const reader = new FileReader();
        reader.onloadend = () => setProfilePhotoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    // Step Validations
    const validateStep1 = () => {
        if (!formData.name.trim()) return 'Please enter your full name';
        if (!normalizeIndianPhone(formData.phone)) return 'Enter a valid Indian mobile number';
        if (!formData.emergency_contact.trim()) return 'Emergency contact is required for your safety';
        if (!formData.gender) return 'Please select your gender';
        if (!formData.permanent_address.trim()) return 'Permanent address is required';
        return null;
    };

    const validateStep2 = () => {
        if (!formData.profile_type) return 'Please select what best describes you';
        if (formData.profile_type === 'STUDENT') {
            if (!formData.college_name.trim()) return 'Your college name is required';
            if (!formData.roll_number.trim()) return 'Your roll number helps us identify you';
        } else {
            if (!formData.office_name.trim()) return 'Your office name is required';
        }
        return null;
    };

    const validateStep3 = () => {
        if (onboardingSettings.require_profile_photo_onboarding && !profilePhotoFile) {
            return 'Profile photo is required by your hostel owner';
        }
        return null;
    };

    const performStepLogic = async (direction) => {
        setError('');
        if (direction === 'next') {
            let err = null;
            if (currentStep === 1) err = validateStep1();
            if (currentStep === 2) err = validateStep2();
            if (err) return setError(err);

            // Auto copy permanent address to temporary if empty
            if (currentStep === 1 && !formData.temporary_address) {
                setFormData(prev => ({ ...prev, temporary_address: formData.permanent_address }));
            }
            setCurrentStep(c => c + 1);
        } else {
            setCurrentStep(c => Math.max(1, c - 1));
        }
    };

    const handleSubmitComplete = async () => {
        const err = validateStep3();
        if (err) return setError(err);

        setIsLoading(true);
        setError('');
        try {
            // Map the frontend state into the API schema
            const payload = {
                name: formData.name.trim(),
                phone: normalizeIndianPhone(formData.phone),
                emergency_contact: formData.emergency_contact.trim(),
                gender: formData.gender,
                personal_email: formData.personal_email?.trim() || null,
                date_of_birth: formData.date_of_birth || null,
                address: formData.permanent_address.trim(), // API legacy map
                temporary_address: formData.temporary_address.trim(),
                permanent_address: formData.permanent_address.trim(),

                profile_type: formData.profile_type,

                // Student
                college_name: formData.college_name.trim() || undefined,
                roll_number: formData.roll_number.trim() || undefined,
                course: formData.course.trim() || undefined,
                year_of_study: formData.year_of_study ? Number(formData.year_of_study) : undefined,
                branch: formData.branch.trim() || undefined,

                // Work
                office_name: formData.office_name.trim() || undefined,
                office_location: formData.office_location.trim() || undefined,
                job_role: formData.job_role.trim() || undefined,
            };

            await tenantService.completeMyProfile(payload, profilePhotoFile);
            setIsSuccess(true);
            setTimeout(() => window.location.href = '/tenant/dashboard', 1500);
        } catch (err) {
            setError(err?.response?.data?.error?.message || err?.response?.data?.detail || 'Submission failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative font-sans">
            {/* Soft decorative background */}
            <div className="fixed inset-0 pointer-events-none flex justify-center items-center overflow-hidden">
                <div className="absolute top-[-10%] sm:w-[800px] sm:h-[800px] w-[400px] h-[400px] bg-ops-accent/10/50 rounded-full blur-3xl mix-blend-multiply" />
                <div className="absolute bottom-[-10%] sm:w-[600px] sm:h-[600px] w-[300px] h-[300px] bg-ops-accent/10/50 rounded-full blur-3xl mix-blend-multiply" />
            </div>

            <main className="w-full max-w-[500px] relative z-10 pt-4 pb-12">

                {/* Header Welcome Card */}
                {!isSuccess && (
                    <div className="mb-8 text-center px-4">
                        <div className="mx-auto w-16 h-16 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center mb-6 overflow-hidden p-2">
                            <img src="/android-chrome-512x512.png" alt="Sri Adithya Hostels" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">Welcome to Sri Adithya Hostels!</h1>
                        <p className="text-slate-500 font-medium mt-2">Let’s quickly set up your profile.</p>
                    </div>
                )}

                {/* Progress Indicators */}
                {!isSuccess && (
                    <div className="flex justify-center items-center gap-3 mb-8">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className="flex flex-col flex-1 max-w-[40px] gap-1.5 items-center">
                                <div className={`h-1.5 w-full rounded-full transition-all duration-300 ${step <= currentStep ? 'bg-ops-accent' : 'bg-slate-200'}`} />
                            </div>
                        ))}
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                        <span className="shrink-0">⚠️</span> {error}
                    </div>
                )}

                <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl relative overflow-hidden rounded-[24px]">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <CardContent className="p-6 sm:p-8">
                        <AnimatePresence mode="wait" initial={false}>
                            {isSuccess ? (
                                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                                    <div className="w-20 h-20 bg-green-100/50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 ring-4 ring-green-50 shadow-sm">
                                        <CheckCircle2 size={40} className="text-green-500" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-3">You're all set!</h2>
                                    <p className="text-slate-500 font-medium mb-8">Your profile has been built securely. Redirecting you to your dashboard...</p>
                                    <Loader2 className="w-8 h-8 text-ops-accent animate-spin mx-auto" />
                                </motion.div>
                            ) : (
                                <motion.div key={`step-${currentStep}`} variants={SlideVariant} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>

                                    {/* -------------------- STAGE 1: IDENTITY -------------------- */}
                                    {currentStep === 1 && (
                                        <div className="space-y-6">
                                            <div className="mb-4">
                                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                    <span className="text-2xl">👤</span> Basics First
                                                </h3>
                                                <p className="text-slate-500 text-sm mt-1">Hostels require this for your safety.</p>
                                            </div>

                                            <div className="space-y-5">
                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                                                        Profile Photo {onboardingSettings.require_profile_photo_onboarding ? '*' : '(Optional)'}
                                                    </Label>
                                                    <label className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                                                        <div className="w-14 h-14 rounded-full overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                                                            {profilePhotoPreview ? (
                                                                <img src={profilePhotoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Camera size={20} className="text-slate-400" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-slate-700">{profilePhotoFile ? 'Photo selected' : 'Upload your photo'}</p>
                                                            <p className="text-xs text-slate-400">JPG/PNG/WEBP, up to 2MB</p>
                                                        </div>
                                                        <Input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleProfilePhotoChange} />
                                                        <span className="text-xs font-semibold text-ops-accent">Choose</span>
                                                    </label>

                                                </div>

                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Full Name</Label>
                                                    <Input name="name" value={formData.name} onChange={handleChange} className="h-12 bg-slate-50/50 border-slate-200" placeholder="Sam Altman" />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Your Phone</Label>
                                                        <Input name="phone" value={indianPhoneDigits(formData.phone)} onChange={handleChange} className="h-12 bg-slate-50/50" placeholder="10-digit mobile" />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Gender</Label>
                                                        <select name="gender" value={formData.gender} onChange={handleChange} className="flex h-12 w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ops-accent/500">
                                                            <option value="" disabled>Select</option>
                                                            <option value="Male">Male</option>
                                                            <option value="Female">Female</option>
                                                            <option value="Other">Other</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Emergency Contact (Parent)</Label>
                                                    <Input name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} className="h-12 bg-slate-50/50" placeholder="Parent's Mobile" />
                                                </div>
                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Date of Birth</Label>
                                                    <Input name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} className="h-12 bg-slate-50/50" />
                                                </div>

                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Permanent Home Address</Label>
                                                    <textarea name="permanent_address" value={formData.permanent_address} onChange={handleChange} className="flex w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ops-accent/500 resize-none h-20" placeholder="Flat No, Street, City, State..." />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* -------------------- STAGE 2: ABOUT YOU -------------------- */}
                                    {currentStep === 2 && (
                                        <div className="space-y-6">
                                            <div className="mb-4">
                                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                    <span className="text-2xl">👋</span> What best describes you?
                                                </h3>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(p => ({ ...p, profile_type: 'STUDENT' }))}
                                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${formData.profile_type === 'STUDENT' ? 'border-ops-accent/600 bg-ops-accent/10 text-ops-accent' : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-500'}`}
                                                >
                                                    <GraduationCap size={32} />
                                                    <span className="font-bold text-sm">Student</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(p => ({ ...p, profile_type: 'WORKING_PROFESSIONAL' }))}
                                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${formData.profile_type === 'WORKING_PROFESSIONAL' ? 'border-purple-600 bg-ops-accent/10 text-purple-700' : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-500'}`}
                                                >
                                                    <Briefcase size={32} />
                                                    <span className="font-bold text-sm">Working</span>
                                                </button>
                                            </div>

                                            <AnimatePresence>
                                                {formData.profile_type === 'STUDENT' && (
                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                                                        <div>
                                                            <Label className="text-xs font-bold uppercase text-slate-500 mb-1 block">College Name *</Label>
                                                            <Input name="college_name" value={formData.college_name} onChange={handleChange} className="h-12 bg-slate-50/50" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <Label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Roll Number *</Label>
                                                                <Input name="roll_number" value={formData.roll_number} onChange={handleChange} className="h-12 bg-slate-50/50" />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Branch / Course</Label>
                                                                <Input name="branch" value={formData.branch} onChange={handleChange} className="h-12 bg-slate-50/50" />
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}

                                                {formData.profile_type === 'WORKING_PROFESSIONAL' && (
                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                                                        <div>
                                                            <Label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Company / Office Name *</Label>
                                                            <Input name="office_name" value={formData.office_name} onChange={handleChange} className="h-12 bg-slate-50/50" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <Label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Job Role</Label>
                                                                <Input name="job_role" value={formData.job_role} onChange={handleChange} className="h-12 bg-slate-50/50" />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Office City</Label>
                                                                <Input name="office_location" value={formData.office_location} onChange={handleChange} className="h-12 bg-slate-50/50" />
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    {/* -------------------- STAGE 3: FINISH -------------------- */}
                                    {currentStep === 3 && (
                                        <div className="space-y-6">
                                            <div className="mb-4">
                                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                    <span className="text-2xl">✅</span> Finish Setup
                                                </h3>
                                                <p className="text-slate-500 text-sm mt-1">Review your details and complete your onboarding.</p>
                                            </div>

                                            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 text-sm text-slate-600">
                                                Your profile is ready to submit. No additional verification is required.
                                            </div>
                                        </div>
                                    )}

                                    {/* -------------------- WIZARD CONTROLS -------------------- */}
                                    <div className="mt-10 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
                                        {currentStep > 1 ? (
                                            <Button type="button" variant="outline" className="h-12 px-6 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => performStepLogic('prev')}>
                                                <ChevronLeft size={18} className="mr-1" /> Back
                                            </Button>
                                        ) : <div />}

                                        {currentStep < 3 ? (
                                            <Button type="button" className="h-12 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10 font-bold" onClick={() => performStepLogic('next')}>
                                                Continue <ChevronRight size={18} className="ml-1" />
                                            </Button>
                                        ) : (
                                            <Button type="button" disabled={isLoading} className="h-12 px-8 rounded-xl bg-ops-accent hover:bg-ops-accent/700 text-white shadow-lg shadow-teal-600/20 font-bold w-full sm:w-auto" onClick={handleSubmitComplete}>
                                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Complete Registration'}
                                            </Button>
                                        )}
                                    </div>

                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default CompleteProfile;
