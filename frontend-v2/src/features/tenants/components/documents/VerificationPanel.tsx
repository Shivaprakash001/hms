import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Check, X, Send, MessageSquare, ChevronDown, ChevronUp, ExternalLink, ShieldCheck } from 'lucide-react';
import { tenantService } from '@features/tenants/api';
import { queryKeys } from '@lib/queryKeys';

interface Props {
  hostelId: string;
  tenantId: string;
  documents: Record<string, unknown>[];
  onUpdated?: () => void;
}

export function VerificationPanel({ hostelId, tenantId, documents, onUpdated }: Props) {
  const qc = useQueryClient();
  const [newMessages, setNewMessages] = useState<Record<string, string>>({});
  const [expandedChats, setExpandedChats] = useState<Record<string, boolean>>({});
  const [rejectingDocId, setRejectingDocId] = useState<string>('');
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const verifyMutation = useMutation({
    mutationFn: (docId: string) => tenantService.verifyDocument(tenantId, docId),
    onSuccess: () => {
      toast.success('Document approved');
      qc.invalidateQueries({ queryKey: queryKeys.tenants.full(hostelId, tenantId) });
      onUpdated?.();
    },
    onError: () => toast.error('Verification failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ docId, reason }: { docId: string; reason: string }) =>
      tenantService.rejectDocument(tenantId, docId, reason),
    onSuccess: () => {
      toast.success('Document query initiated');
      setRejectingDocId('');
      qc.invalidateQueries({ queryKey: queryKeys.tenants.full(hostelId, tenantId) });
      onUpdated?.();
    },
    onError: () => toast.error('Rejection failed'),
  });

  const messageMutation = useMutation({
    mutationFn: ({ docId, message }: { docId: string; message: string }) =>
      tenantService.postDocumentMessage(tenantId, docId, message),
    onSuccess: (_, variables) => {
      setNewMessages((prev) => ({ ...prev, [variables.docId]: '' }));
      qc.invalidateQueries({ queryKey: queryKeys.tenants.full(hostelId, tenantId) });
      onUpdated?.();
    },
    onError: () => toast.error('Failed to send message'),
  });

  const verifyAllMutation = useMutation({
    mutationFn: () => tenantService.verifyAllDocuments(tenantId),
    onSuccess: () => {
      toast.success('All active documents approved');
      qc.invalidateQueries({ queryKey: queryKeys.tenants.full(hostelId, tenantId) });
      onUpdated?.();
    },
    onError: () => toast.error('Could not approve all documents'),
  });

  if (!documents?.length) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground bg-muted/20">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
        No identification documents on file. Upload may be handled during tenant onboarding.
      </div>
    );
  }

  const handleSendMessage = (docId: string) => {
    const text = (newMessages[docId] || '').trim();
    if (!text) return;
    messageMutation.mutate({ docId, message: text });
  };

  const toggleChat = (docId: string) => {
    setExpandedChats((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  const pendingCount = documents.filter((doc) => String(doc.document_status ?? doc.status ?? 'PENDING').toUpperCase() === 'PENDING').length;
  const approvedCount = documents.filter((doc) => {
    const status = String(doc.document_status ?? doc.status ?? '').toUpperCase();
    return status === 'APPROVED' || doc.is_verified === true;
  }).length;
  const rejectedCount = documents.filter((doc) => String(doc.document_status ?? doc.status ?? '').toUpperCase() === 'REJECTED').length;
  const unverifiedCount = documents.length - approvedCount;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Document verification</p>
            <p className="text-xs text-muted-foreground mt-1">
              Review active tenant submissions. Replacements archive the old file automatically.
            </p>
          </div>
          <button
            type="button"
            disabled={unverifiedCount === 0 || verifyAllMutation.isPending}
            onClick={() => verifyAllMutation.mutate()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            Approve all unverified
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="rounded-xl bg-amber-500/10 px-3 py-2">
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
            <p className="text-lg font-bold text-emerald-600">{approvedCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Approved</p>
          </div>
          <div className="rounded-xl bg-rose-500/10 px-3 py-2">
            <p className="text-lg font-bold text-rose-600">{rejectedCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Queried</p>
          </div>
        </div>
      </div>

      {documents.map((doc) => {
        const id = String(doc.id ?? '');
        const status = String(doc.document_status ?? doc.status ?? 'PENDING').toUpperCase();
        const fileUrl = String(doc.file_url ?? '');
        const docNumber = String(doc.doc_number ?? '').trim();
        const fileSize = Number(doc.file_size ?? 0);
        const fileSizeLabel = fileSize > 0 ? `${(fileSize / 1024 / 1024).toFixed(1)} MB` : '';
        
        let chatMessages: { sender: string; sender_name: string; message: string; timestamp: string }[] = [];
        try {
          const reasonStr = String(doc.rejection_reason || '');
          if (reasonStr.startsWith('[') && reasonStr.endsWith(']')) {
            chatMessages = JSON.parse(reasonStr);
          } else if (reasonStr) {
            chatMessages = [{ sender: 'owner', sender_name: 'Owner Query', message: reasonStr, timestamp: '' }];
          }
        } catch {
          chatMessages = [];
        }

        const isChatExpanded = expandedChats[id] || chatMessages.length > 0;

        return (
          <div key={id} className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
            {/* Header section with Doc Type and status */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{String(doc.doc_type ?? doc.type ?? 'Document')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Uploaded on {new Date(String(doc.created_at)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {docNumber && <span>No. {docNumber}</span>}
                    {doc.mime_type && <span>{String(doc.mime_type).replace('application/', '').replace('image/', '').toUpperCase()}</span>}
                    {fileSizeLabel && <span>{fileSizeLabel}</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25' :
                  status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25' :
                  'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                }`}>
                  {status}
                </span>

                {fileUrl && (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="View Document"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Verification action buttons for Owner */}
            {status === 'PENDING' && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
                <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate(id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 active:scale-98 transition-all text-xs font-semibold shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Approve Document
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingDocId(rejectingDocId === id ? '' : id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 active:scale-98 transition-all text-xs font-semibold border border-rose-500/20"
                >
                  <X className="w-4 h-4" />
                  Reject / Query
                </button>
                </div>

                {rejectingDocId === id && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-2">
                    <textarea
                      rows={3}
                      maxLength={800}
                      placeholder="Tell the tenant what needs to be corrected..."
                      value={rejectReasons[id] || ''}
                      onChange={(e) => setRejectReasons((prev) => ({ ...prev, [id]: e.target.value }))}
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectingDocId('')}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={rejectMutation.isPending || !(rejectReasons[id] || '').trim()}
                        onClick={() => rejectMutation.mutate({ docId: id, reason: (rejectReasons[id] || '').trim() })}
                        className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Send query
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conversation / Query Section */}
            <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
              <button
                type="button"
                onClick={() => toggleChat(id)}
                className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {chatMessages.length > 0
                    ? `Verification Thread (${chatMessages.length} messages)`
                    : 'Start Verification Chat / Query'}
                </span>
                {isChatExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isChatExpanded && (
                <div className="space-y-4 pt-2">
                  {/* Chat messages viewport */}
                  {chatMessages.length > 0 && (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {chatMessages.map((msg, idx) => {
                        const isOwner = msg.sender === 'owner';
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col max-w-[85%] ${isOwner ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                          >
                            <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                              {msg.sender_name}
                            </span>
                            <div className={`p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                              isOwner
                                ? 'bg-accent text-accent-foreground rounded-tr-none'
                                : 'bg-secondary text-secondary-foreground rounded-tl-none'
                            }`}>
                              {msg.message}
                            </div>
                            {msg.timestamp && (
                              <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Input field to send new message */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a query or message for the tenant..."
                      value={newMessages[id] || ''}
                      onChange={(e) => setNewMessages((prev) => ({ ...prev, [id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage(id);
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      type="button"
                      disabled={messageMutation.isPending}
                      onClick={() => handleSendMessage(id)}
                      className="p-2.5 rounded-xl bg-accent text-accent-foreground hover:opacity-90 active:scale-95 transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
