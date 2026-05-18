import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, User, Phone, Mail, Home, BookOpen, GraduationCap, 
  MapPin, CreditCard, Calendar, CheckCircle2, AlertCircle, X, 
  Check, Download, ZoomIn
} from 'lucide-react';
import api from '../../api/axios';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatCurrency, formatDate } from '../../utils/format';
import { queryKeys } from '../../lib/query/queryKeys';
import { useHostelContext } from '../../context/HostelContext';

// --- Local Service Helper ---
const fetchTenantFull = async (id) => {
    const res = await api.get(`/tenants/${id}/full`);
    return res.data;
};

const verifyDocument = async ({ tenantId, docId }) => {
    const res = await api.patch(`/tenants/${tenantId}/documents/${docId}/verify`);
    return res.data;
};

const rejectDocument = async ({ tenantId, docId, reason }) => {
    const res = await api.patch(`/tenants/${tenantId}/documents/${docId}/reject`, { reason });
    return res.data;
};

export default function TenantProfilePage() {
  const { preferences } = useAppPreferences();
  const { hostelId } = useHostelContext();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [previewDoc, setPreviewDoc] = useState(null);

  const { data: tenant, isLoading, isError } = useQuery({
    queryKey: queryKeys.tenants.detail(hostelId, id),
    queryFn: () => fetchTenantFull(id),
    staleTime: 5 * 60 * 1000,
  });

  const verifyMutation = useMutation({
    mutationFn: verifyDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(hostelId, id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: rejectDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(hostelId, id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ops-accent/600"></div>
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-slate-100 mt-8 max-w-2xl mx-auto">
        <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Failed to load tenant</h2>
        <p className="text-slate-500 mt-2 mb-6">The tenant might not exist or you don't have access.</p>
        <button onClick={() => navigate(`/hostels/${hostelId}/tenants`)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-xl font-bold transition">
          Go Back
        </button>
      </div>
    );
  }

  const profile = tenant.profile || {};
  const roomAllocation = tenant.allocations?.[0];
  const currentRoom = roomAllocation?.room?.room_no || 'Unassigned';
  const documents = tenant.documents || [];
  const latestPayment = tenant.payments?.[0];
  
  // Formatters
  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
  };

  return (
    <div className="font-sans pb-24 md:pb-8 max-w-4xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center gap-4 mb-6 sticky top-0 bg-slate-50 py-4 z-10">
        <button onClick={() => navigate(-1)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-500 hover:text-ops-accent hover:border-ops-accent/200 transition-colors shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-none">Tenant Profile</h1>
      </div>

      <div className="space-y-6">
        {/* 1. OVERVIEW CARD */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-ops-accent/10 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
            <div className="w-24 h-24 rounded-[1.5rem] bg-ops-accent/15 text-ops-accent flex items-center justify-center text-3xl font-black shadow-inner overflow-hidden shrink-0">
               {tenant.photo_url ? (
                  <img src={tenant.photo_url} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                  getInitials(profile.name)
               )}
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-2 w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{profile.name}</h2>
                  <p className="text-slate-500 font-medium">{tenant.course || ''} {tenant.branch ? `• ${tenant.branch}` : ''} {tenant.year_of_study ? `• ${tenant.year_of_study} Year` : ''}</p>
                </div>
                
                <div className="flex flex-wrap justify-center md:justify-end gap-2">
                   <span className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase flex items-center gap-1.5 border ${
                      tenant.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      tenant.status === 'LEFT' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                   }`}>
                      {tenant.status === 'ACTIVE' && <CheckCircle2 size={14} />}
                      {tenant.status}
                   </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-50 text-left">
                <div>
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Room</p>
                  <p className="font-bold text-slate-800">{currentRoom}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Monthly Rent</p>
                  <p className="font-bold border-slate-800 bg-ops-accent/10 text-ops-accent w-fit px-2 py-0.5 rounded-lg">{formatCurrency(tenant.monthly_rent, preferences)}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Roll No.</p>
                  <p className="font-bold text-slate-800">{tenant.roll_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Joined Date</p>
                  <p className="font-bold text-slate-800">{formatDate(tenant.joined_on, preferences, 'N/A')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. PERSONAL INFO */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-ops-accent/10 text-ops-accent rounded-xl"><User size={20} className="stroke-[2.5px]" /></div>
            <h3 className="text-lg font-black text-slate-800">Personal Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
            <DetailItem icon={Phone} label="Primary Phone" value={profile.phone} />
            <DetailItem icon={Phone} label="Secondary Phone" value={tenant.phone_2} />
            <DetailItem icon={Mail} label="Email Address" value={profile.email} />
            <DetailItem icon={Phone} label="Emergency Contact" value={profile.emergency_contact} />
            
            <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-50">
              <div>
                 <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1.5"><MapPin size={12}/> Permanent Address</p>
                 <p className="text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                   {tenant.permanent_address || 'Not provided'}
                 </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. ACADEMIC INFO */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-ops-accent/10 text-ops-accent rounded-xl"><GraduationCap size={20} className="stroke-[2.5px]" /></div>
            <h3 className="text-lg font-black text-slate-800">Academic Details</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <DetailItem label="College" value={tenant.college_name} />
            <DetailItem label="Course" value={tenant.course} />
            <DetailItem label="Branch" value={tenant.branch} />
            <DetailItem label="Year of Study" value={tenant.year_of_study ? `${tenant.year_of_study} Year` : null} />
            <DetailItem label="Section" value={tenant.section} />
          </div>
        </section>

        {/* 4. DOCUMENTS VERIFICATION */}
        <section className="bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-lg text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md"><BookOpen size={20} className="text-indigo-300 stroke-[2.5px]" /></div>
              <h3 className="text-lg font-black text-white">Document Verification</h3>
            </div>
            
            {documents.length === 0 ? (
               <div className="text-center py-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                 <p className="text-slate-400 mb-2">No documents uploaded</p>
                 <span className="px-3 py-1 bg-white/10 rounded-md text-xs font-semibold text-slate-300 uppercase tracking-widest">Pending Upload</span>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map(doc => (
                  <div key={doc.id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">{doc.doc_type.replace('_', ' ')}</h4>
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase ${
                          doc.document_status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                          doc.document_status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {doc.document_status === 'APPROVED' ? 'Verified' : 
                           doc.document_status === 'REJECTED' ? 'Rejected' : 'Pending Verification'}
                        </span>
                      </div>
                      
                      {doc.doc_number && (
                        <p className="text-slate-400 text-sm font-mono tracking-widest mb-4">
                          {doc.doc_number.replace(/(.{4})/g, '$1 ').trim()}
                        </p>
                      )}

                      {doc.document_status === 'REJECTED' && doc.rejection_reason && (
                         <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                            <p className="text-xs font-black uppercase tracking-widest text-rose-400 mb-1">Reason for Rejection</p>
                            <p className="text-sm text-slate-300">{doc.rejection_reason}</p>
                         </div>
                      )}
                      
                      <button 
                        onClick={() => setPreviewDoc(doc.file_url)}
                        className="flex items-center gap-2 text-sm font-bold text-indigo-300 hover:text-indigo-200 transition-colors mb-6"
                      >
                         <ZoomIn size={16} /> View Document
                      </button>
                    </div>

                    {doc.document_status === 'PENDING' && (
                      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
                        <button 
                          onClick={() => {
                             const reason = prompt("Enter reason for rejection:");
                             if (reason !== null && reason.trim() !== "") {
                                rejectMutation.mutate({ tenantId: id, docId: doc.id, reason });
                             }
                          }}
                          disabled={rejectMutation.isPending}
                          className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-rose-500/20 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button 
                          onClick={() => verifyMutation.mutate({ tenantId: id, docId: doc.id })}
                          disabled={verifyMutation.isPending}
                          className="py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-emerald-500/30 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 5. PAYMENTS & RENT */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 mb-20 md:mb-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><CreditCard size={20} className="stroke-[2.5px]" /></div>
              <h3 className="text-lg font-black text-slate-800">Financial Overview</h3>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Monthly Rent</p>
                <div className="flex items-baseline gap-1">
                   <p className="text-3xl font-black text-slate-800">{formatCurrency(tenant.monthly_rent, preferences)}</p>
                   <span className="text-slate-500 font-bold text-sm">/mo</span>
                </div>
             </div>
             <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Last Payment</p>
                {latestPayment ? (
                  <div>
                    <p className="text-3xl font-black text-slate-800">{formatCurrency(latestPayment.amount_paid, preferences)}</p>
                    <p className="text-slate-500 font-medium text-sm mt-1">{formatDate(latestPayment.payment_date, preferences, 'N/A')} • {latestPayment.payment_method}</p>
                  </div>
                ) : (
                  <p className="text-slate-400 font-bold mt-2">No payments yet</p>
                )}
             </div>
          </div>
        </section>
      </div>

      {/* Floating Action Bar (Mobile & Desktop) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-white border-t border-slate-200 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.1)] z-40 md:relative md:bg-transparent md:border-none md:shadow-none md:mt-8">
         <div className="max-w-4xl mx-auto flex gap-3">
            <button className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-widest text-xs md:text-sm rounded-xl transition-colors">
               Manage Room
            </button>
            <button className="flex-1 py-4 bg-ops-accent hover:bg-ops-accent/700 text-white font-black uppercase tracking-widest text-xs md:text-sm rounded-xl transition-all shadow-lg shadow-teal-600/20 active:scale-[0.98]">
               Record Payment
            </button>
         </div>
      </div>

      {/* Document Viewer Modal */}
      {previewDoc && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
            <button 
              onClick={() => setPreviewDoc(null)} 
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X size={24} />
            </button>
            <img 
               src={previewDoc} 
               alt="Document Preview" 
               className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
            />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
              <a 
                 href={previewDoc} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="px-6 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl flex items-center gap-2 hover:bg-slate-200 transition-colors"
              >
                 <Download size={16} /> Download Source
              </a>
            </div>
         </div>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={12} />} {label}
      </p>
      <p className="font-bold text-slate-800 text-sm md:text-base">
        {value || <span className="text-slate-300 font-medium italic">Not specified</span>}
      </p>
    </div>
  );
}
