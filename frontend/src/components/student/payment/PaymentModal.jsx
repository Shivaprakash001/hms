import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, CreditCard, Smartphone, Globe, Loader2, QrCode, ShieldCheck, AlertCircle } from 'lucide-react';
import { paymentService } from '../../../api/services';

const loadRazorpayScript = () =>
    new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

const PaymentModal = ({ isOpen, onClose, amount, obligationId, onSuccess }) => {
    const [step, setStep] = useState('method'); // method, processing, success
    const [method, setMethod] = useState('upi'); // upi, card, netbanking
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setStep('method');
            setMethod('upi');
            setLoading(false);
            setError(null);
        }
    }, [isOpen]);

    const handlePayment = async () => {
        setLoading(true);
        setError(null);

        try {
            // 1. Load Razorpay SDK dynamically
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                throw new Error('Failed to load payment gateway. Please check your internet connection.');
            }

            // 2. Create Razorpay order via backend
            const orderData = await paymentService.initiatePayment({
                ...(obligationId ? { obligation_id: obligationId } : {}),
                amount: amount
            });

            // 3. Configure and open Razorpay Checkout widget
            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: orderData.currency,
                name: orderData.name,
                description: orderData.description,
                order_id: orderData.order_id,
                prefill: orderData.prefill || {},
                notes: orderData.notes || {},
                theme: { color: '#4F46E5' },
                handler: (response) => {
                    // Payment captured – webhook will record it in the database
                    setLoading(false);
                    setStep('success');
                    setTimeout(() => {
                        onSuccess({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            amount: amount
                        });
                    }, 1500);
                },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (response) => {
                setError(response.error.description || 'Payment failed. Please try again.');
                setLoading(false);
            });
            rzp.open();
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Failed to initiate payment.');
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={!loading ? onClose : undefined}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden relative">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-md">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Payment Gateway</h2>
                                    <p className="text-sm text-slate-500 font-medium">Secure Transaction</p>
                                </div>
                                {!loading && step !== 'success' && (
                                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                        <X size={20} />
                                    </button>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                {step === 'method' && (
                                    <div className="space-y-6">
                                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                                            <span className="text-sm font-bold text-slate-600">Total Amount</span>
                                            <span className="text-2xl font-black text-indigo-700">₹{amount.toLocaleString()}</span>
                                        </div>

                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Method</p>

                                            {/* UPI Option */}
                                            <button
                                                onClick={() => setMethod('upi')}
                                                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${method === 'upi' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'upi' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    <Smartphone size={20} />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className={`font-bold ${method === 'upi' ? 'text-indigo-900' : 'text-slate-700'}`}>UPI / QR</p>
                                                    <p className="text-xs text-slate-500">Google Pay, PhonePe, Paytm</p>
                                                </div>
                                                {method === 'upi' && <div className="w-4 h-4 rounded-full bg-indigo-600" />}
                                            </button>

                                            {/* Card Option */}
                                            <button
                                                onClick={() => setMethod('card')}
                                                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${method === 'card' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'card' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    <CreditCard size={20} />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className={`font-bold ${method === 'card' ? 'text-indigo-900' : 'text-slate-700'}`}>Cards</p>
                                                    <p className="text-xs text-slate-500">Debit / Credit Card</p>
                                                </div>
                                                {method === 'card' && <div className="w-4 h-4 rounded-full bg-indigo-600" />}
                                            </button>

                                            {/* Net Banking Option */}
                                            <button
                                                onClick={() => setMethod('netbanking')}
                                                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${method === 'netbanking' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'netbanking' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    <Globe size={20} />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className={`font-bold ${method === 'netbanking' ? 'text-indigo-900' : 'text-slate-700'}`}>Net Banking</p>
                                                    <p className="text-xs text-slate-500">All Indian Banks</p>
                                                </div>
                                                {method === 'netbanking' && <div className="w-4 h-4 rounded-full bg-indigo-600" />}
                                            </button>
                                        </div>

                                        {/* Method Specific Content */}
                                        {method === 'upi' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-3"
                                            >
                                                <div className="w-32 h-32 bg-white mx-auto rounded-lg border border-slate-200 flex items-center justify-center">
                                                    <QrCode size={80} className="text-slate-800" />
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium">Scan to Pay via any UPI App</p>
                                            </motion.div>
                                        )}

                                        {/* Error message */}
                                        {error && (
                                            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">
                                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                                <span>{error}</span>
                                            </div>
                                        )}

                                        <button
                                            onClick={handlePayment}
                                            disabled={loading}
                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                                            {loading ? 'Opening Payment Gateway...' : `Pay ₹${amount.toLocaleString()}`}
                                        </button>
                                    </div>
                                )}

                                {step === 'success' && (
                                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                            className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"
                                        >
                                            <CheckCircle size={40} strokeWidth={3} />
                                        </motion.div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900">Payment Successful!</h3>
                                            <p className="text-slate-500 mt-1">Your payment is being processed.</p>
                                        </div>
                                        <div className="bg-slate-50 px-6 py-3 rounded-xl border border-slate-100">
                                            <p className="text-sm font-medium text-slate-500">Amount Paid</p>
                                            <p className="text-2xl font-black text-slate-900">₹{amount.toLocaleString()}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default PaymentModal;
