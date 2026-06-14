import { useState, useEffect, useRef } from "react";
import { Upload, X, ShieldAlert, FileText, CheckCircle2, PenTool, Image as ImageIcon, RotateCw, Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { ownerService } from "@features/owners/api";
import { SignaturePad } from "@shared/ui/inputs";
import { SectionShell, Field, inp, SkeletonSection } from "./shared";

interface Props {
  hostelId: string;
}

interface TemplateData {
  title: string;
  owner_name: string;
  owner_signature_url: string | null;
  custom_rules: string;
  hostel_rules?: any;
}

const PLACEHOLDERS = [
  { label: "Tenant Name", value: "{{tenantName}}" },
  { label: "Tenant Phone", value: "{{tenantPhone}}" },
  { label: "Room No", value: "{{roomNo}}" },
  { label: "Monthly Rent", value: "{{monthlyRent}}" },
  { label: "Security Deposit", value: "{{advanceDeposit}}" },
  { label: "Maintenance Fee", value: "{{maintenanceCharge}}" },
  { label: "Joining Date", value: "{{joiningDate}}" },
  { label: "Hostel Name", value: "{{hostelName}}" },
];

export function AgreementSettingsSection({ hostelId }: Props) {
  const [templateType, setTemplateType] = useState<"RESIDENCY" | "RENEWAL" | "MOVE_OUT">("RESIDENCY");
  const [local, setLocal] = useState<TemplateData>({
    title: "",
    owner_name: "",
    owner_signature_url: null,
    custom_rules: "",
    hostel_rules: null,
  });
  const snap = useRef<TemplateData>(local);
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sigMethod, setSigMethod] = useState<"upload" | "draw">("upload");
  const [drawnBlob, setDrawnBlob] = useState<Blob | null>(null);

  // PDF Preview State
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [previewTab, setPreviewTab] = useState<"html" | "pdf">("html");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ownerService.getAgreementTemplate(hostelId, templateType);
      const data = res?.data ?? res;
      
      // Prefer draft if exists, else active
      const template = data?.draft || data?.active;
      
      const mapped: TemplateData = {
        title: template?.title || (templateType === "RESIDENCY" ? "Standard Tenant Agreement" : templateType === "RENEWAL" ? "Renewal Agreement" : "Move-out Agreement"),
        owner_name: template?.owner_name || "",
        owner_signature_url: template?.owner_signature_url || null,
        custom_rules: template?.custom_rules || "",
        hostel_rules: template?.rules_content || data?.default_rules || null,
      };

      setLocal(mapped);
      snap.current = mapped;
      setHasDraft(!!data?.draft);
    } catch (err: any) {
      console.error("Failed to load agreement template", err);
      setError(err?.response?.data?.error?.message || "Failed to load agreement template");
    } finally {
      setLoading(false);
    }
  };

  // Load template on mount, hostelId change, or templateType change
  useEffect(() => {
    fetchTemplate();
    
    // Clear pdf preview on tab/hostel change
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setPreviewTab("html");
  }, [hostelId, templateType]);

  // Clean up PDF blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const isDirty =
    local.title !== snap.current.title ||
    local.owner_name !== snap.current.owner_name ||
    local.custom_rules !== snap.current.custom_rules ||
    local.owner_signature_url !== snap.current.owner_signature_url ||
    JSON.stringify(local.hostel_rules) !== JSON.stringify(snap.current.hostel_rules);

  const handleSave = async (action: "save_draft" | "publish" = "save_draft") => {
    if (!local.owner_name.trim()) {
      setError("Authorized Signatory Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ownerService.updateAgreementTemplate(hostelId, {
        action,
        type: templateType,
        title: local.title,
        owner_name: local.owner_name,
        custom_rules: local.custom_rules,
        owner_signature_url: local.owner_signature_url,
        rules_content: local.hostel_rules,
      });
      toast.success(action === "publish" ? "Agreement template published successfully!" : "Draft saved successfully.");
      await fetchTemplate();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to save agreement template");
      toast.error("Failed to save agreement template");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocal(snap.current);
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const res = await ownerService.uploadOwnerSignatureStamp(hostelId, file);
      const data = res?.data ?? res;
      setLocal((prev) => ({
        ...prev,
        owner_signature_url: data?.owner_signature_url || prev.owner_signature_url,
      }));
      toast.success("Signature stamp uploaded successfully");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to upload signature stamp");
      toast.error("Failed to upload signature stamp");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDrawnSignature = async () => {
    if (!drawnBlob) return;
    setUploading(true);
    setError(null);
    try {
      const file = new File([drawnBlob], "owner_signature.png", { type: "image/png" });
      const res = await ownerService.uploadOwnerSignatureStamp(hostelId, file);
      const data = res?.data ?? res;
      setLocal((prev) => ({
        ...prev,
        owner_signature_url: data?.owner_signature_url || prev.owner_signature_url,
      }));
      setDrawnBlob(null);
      toast.success("Signature stamp drawn and saved successfully");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to save drawn signature");
      toast.error("Failed to save drawn signature");
    } finally {
      setUploading(false);
    }
  };

  const handleRotateExistingSignature = async () => {
    if (!local.owner_signature_url) return;
    setUploading(true);
    setError(null);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to load signature image for rotation. Check CORS policy."));
        const separator = local.owner_signature_url!.includes("?") ? "&" : "?";
        img.src = local.owner_signature_url! + separator + "t=" + Date.now();
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get 2D context");

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });

      if (!blob) throw new Error("Failed to generate rotated image blob");

      const file = new File([blob], "owner_signature_rotated.png", { type: "image/png" });
      const res = await ownerService.uploadOwnerSignatureStamp(hostelId, file);
      const data = res?.data ?? res;
      
      setLocal((prev) => ({
        ...prev,
        owner_signature_url: data?.owner_signature_url || prev.owner_signature_url,
      }));
      toast.success("Signature stamp rotated successfully");
    } catch (err: any) {
      console.error("Failed to rotate signature:", err);
      setError(err?.message || "Failed to rotate signature stamp. Make sure the image is fully loaded.");
      toast.error("Failed to rotate signature stamp");
    } finally {
      setUploading(false);
    }
  };

  const upd = (k: keyof TemplateData, v: any) => {
    setLocal((prev) => ({ ...prev, [k]: v }));
  };

  // Placeholders handler
  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = local.custom_rules;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newValue = before + placeholder + after;
    upd("custom_rules", newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
    }, 0);
  };

  // Structured Categories state updates
  const updateCategoryTitle = (catId: string, title: string) => {
    setLocal((prev) => {
      const categories = (prev.hostel_rules?.categories || []).map((c: any) =>
        c.id === catId ? { ...c, title } : c
      );
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const updateHighlight = (catId: string, idx: number, val: string) => {
    setLocal((prev) => {
      const categories = (prev.hostel_rules?.categories || []).map((c: any) => {
        if (c.id === catId) {
          const highlights = [...(c.highlights || [])];
          highlights[idx] = val;
          return { ...c, highlights };
        }
        return c;
      });
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const addHighlight = (catId: string) => {
    setLocal((prev) => {
      const categories = (prev.hostel_rules?.categories || []).map((c: any) => {
        if (c.id === catId) {
          return { ...c, highlights: [...(c.highlights || []), ""] };
        }
        return c;
      });
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const removeHighlight = (catId: string, idx: number) => {
    setLocal((prev) => {
      const categories = (prev.hostel_rules?.categories || []).map((c: any) => {
        if (c.id === catId) {
          return { ...c, highlights: (c.highlights || []).filter((_: any, i: number) => i !== idx) };
        }
        return c;
      });
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const updateRule = (catId: string, idx: number, val: string) => {
    setLocal((prev) => {
      const categories = (prev.hostel_rules?.categories || []).map((c: any) => {
        if (c.id === catId) {
          const rules = [...(c.rules || [])];
          rules[idx] = val;
          return { ...c, rules };
        }
        return c;
      });
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const addRule = (catId: string) => {
    setLocal((prev) => {
      const categories = (prev.hostel_rules?.categories || []).map((c: any) => {
        if (c.id === catId) {
          return { ...c, rules: [...(c.rules || []), ""] };
        }
        return c;
      });
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const removeRule = (catId: string, idx: number) => {
    setLocal((prev) => {
      const categories = (prev.hostel_rules?.categories || []).map((c: any) => {
        if (c.id === catId) {
          return { ...c, rules: (c.rules || []).filter((_: any, i: number) => i !== idx) };
        }
        return c;
      });
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const addCategory = () => {
    setLocal((prev) => {
      const categories = [
        ...(prev.hostel_rules?.categories || []),
        {
          id: `cat-${Date.now()}`,
          title: "New Category",
          highlights: [],
          rules: ["New Rule Description"],
        },
      ];
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const removeCategory = (catId: string) => {
    setLocal((prev) => {
      const categories = (prev.hostel_rules?.categories || []).filter((c: any) => c.id !== catId);
      return { ...prev, hostel_rules: { ...prev.hostel_rules, categories } };
    });
  };

  const generatePdfPreview = async () => {
    setLoadingPdf(true);
    try {
      const blob = await ownerService.getAgreementTemplatePreview(hostelId, {
        type: templateType,
        title: local.title,
        owner_name: local.owner_name,
        owner_signature_url: local.owner_signature_url,
        custom_rules: local.custom_rules,
        rules_content: local.hostel_rules,
      });

      const url = URL.createObjectURL(blob);
      
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      setPdfBlobUrl(url);
      setPreviewTab("pdf");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate PDF preview");
    } finally {
      setLoadingPdf(false);
    }
  };

  if (loading) {
    return <SkeletonSection />;
  }

  return (
    <SectionShell
      title={`${templateType === "RESIDENCY" ? "Residency" : templateType === "RENEWAL" ? "Renewal" : "Move-out"} Agreement Template`}
      description="Configure default contract templates, custom house rules, and signature stamps for automatic tenant onboarding PDFs."
      isDirty={isDirty}
      saving={saving}
      onSave={() => handleSave("save_draft")}
      onReset={handleReset}
      error={error}
    >
      <div className="space-y-6">
        {/* Template Type Tabs */}
        <div className="flex gap-2 p-1 bg-secondary/50 border border-border/80 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setTemplateType("RESIDENCY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              templateType === "RESIDENCY"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Residency Agreement
          </button>
          <button
            type="button"
            onClick={() => setTemplateType("RENEWAL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              templateType === "RENEWAL"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Renewal Agreement
          </button>
          <button
            type="button"
            onClick={() => setTemplateType("MOVE_OUT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              templateType === "MOVE_OUT"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Move-out Agreement
          </button>
        </div>

        {/* Publish Banner */}
        {hasDraft && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/80 leading-relaxed">
                <span className="font-semibold text-amber-500 block">Unpublished Draft version</span>
                You have unsaved changes in draft mode. New tenants will continue signing the old version until you publish this draft.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSave("publish")}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0 self-end sm:self-center"
            >
              {saving ? "Publishing..." : "Publish Live Version"}
            </button>
          </div>
        )}

        {/* Tip banner */}
        <div className="flex items-start gap-3 p-3 bg-accent/10 border border-accent/20 rounded-xl">
          <FileText className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="text-xs text-foreground/80 leading-relaxed">
            <span className="font-semibold text-accent block mb-0.5">Immutable PDF Agreement Flow</span>
            During onboarding, tenants will review and sign this agreement. A legally compliant PDF snapshot will be generated with rent details, deposits, custom rules, and signatures, and then stored permanently in Supabase Storage.
          </div>
        </div>

        {/* Core fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Agreement Title" hint="E.g., Hostels Residency Rules & Agreement">
            <input
              type="text"
              className={inp}
              value={local.title}
              onChange={(e) => upd("title", e.target.value)}
              placeholder="E.g., Hostels Residency Rules & Agreement"
            />
          </Field>

          <Field label="Authorized Signatory Name" hint="Full name of owner, partner, or manager signing for the hostel">
            <input
              type="text"
              className={inp}
              value={local.owner_name}
              onChange={(e) => upd("owner_name", e.target.value)}
              placeholder="E.g., Shivaprakash M."
            />
          </Field>
        </div>

        {/* Structured Categories Editor */}
        <div className="border-t border-border pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Structured Rules Categories
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                Organize rules into distinct sections. Each section can have bullet points (rules) and optional bold highlights.
              </p>
            </div>
            <button
              type="button"
              onClick={addCategory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Category
            </button>
          </div>

          <div className="space-y-4">
            {(local.hostel_rules?.categories || []).map((cat: any, cIdx: number) => (
              <div key={cat.id || cIdx} className="bg-secondary/20 border border-border rounded-xl p-4 space-y-4 relative">
                <button
                  type="button"
                  onClick={() => removeCategory(cat.id)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove Category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="max-w-[85%]">
                  <Field label={`Category ${cIdx + 1} Title`}>
                    <input
                      type="text"
                      className={inp}
                      value={cat.title}
                      onChange={(e) => updateCategoryTitle(cat.id, e.target.value)}
                      placeholder="Category Title"
                    />
                  </Field>
                </div>

                {/* Highlights */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Section Highlights (Optional, Bold & Highlighted)
                  </label>
                  <div className="space-y-2">
                    {(cat.highlights || []).map((hl: string, hIdx: number) => (
                      <div key={hIdx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          className={`${inp} py-1.5`}
                          value={hl}
                          onChange={(e) => updateHighlight(cat.id, hIdx, e.target.value)}
                          placeholder="E.g., Zero tolerance for noise after 10 PM"
                        />
                        <button
                          type="button"
                          onClick={() => removeHighlight(cat.id, hIdx)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addHighlight(cat.id)}
                      className="flex items-center gap-1 text-[11px] text-accent hover:underline font-semibold"
                    >
                      <Plus className="w-3 h-3" /> Add Highlight
                    </button>
                  </div>
                </div>

                {/* Rules */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Rules & Bullet Points
                  </label>
                  <div className="space-y-2">
                    {(cat.rules || []).map((rule: string, rIdx: number) => (
                      <div key={rIdx} className="flex gap-2 items-start">
                        <textarea
                          rows={2}
                          className={`${inp} py-1.5`}
                          value={rule}
                          onChange={(e) => updateRule(cat.id, rIdx, e.target.value)}
                          placeholder="Enter a rule description..."
                        />
                        <button
                          type="button"
                          onClick={() => removeRule(cat.id, rIdx)}
                          className="text-muted-foreground hover:text-destructive p-1 mt-1.5"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addRule(cat.id)}
                      className="flex items-center gap-1 text-[11px] text-accent hover:underline font-semibold"
                    >
                      <Plus className="w-3 h-3" /> Add Rule
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Rules */}
        <div className="space-y-2">
          <Field
            label="Additional Custom Rules / Terms & Conditions"
            hint="These custom rules will be appended to the bottom of the contract terms."
          >
            {/* Placeholders Helper */}
            <div className="space-y-1 pb-1">
              <span className="text-[10px] font-semibold text-muted-foreground block uppercase">Insert Placeholders</span>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => insertPlaceholder(p.value)}
                    className="px-2 py-1 bg-secondary hover:bg-secondary/80 text-foreground/80 border border-border/80 rounded-md text-[10px] font-semibold transition-all hover:scale-105"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              className={`${inp} min-h-[160px] font-mono text-xs leading-relaxed`}
              value={local.custom_rules}
              onChange={(e) => upd("custom_rules", e.target.value)}
              placeholder="E.g.,&#10;1. Monthly rent must be paid on or before the 5th of each calendar month.&#10;2. Security deposit is refundable only upon serving a 30-day notice period.&#10;3. External visitors/guests are not allowed inside rooms after 8:00 PM."
            />
          </Field>
        </div>

        {/* Signature Section */}
        <div className="border-t border-border pt-5 space-y-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Owner Signature / Stamp
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Configure how your landlord signature is placed on agreements. You can either upload a signature stamp/image file, or draw your signature directly on a canvas. A transparent background is highly recommended.
          </p>

          {/* Toggle Tab */}
          <div className="flex gap-2 p-1 bg-secondary/50 border border-border/80 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setSigMethod("upload")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sigMethod === "upload"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => setSigMethod("draw")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sigMethod === "draw"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Draw Signature
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-6 pt-2">
            {/* Stamp preview */}
            <div className="w-48 h-24 border border-dashed border-border rounded-xl bg-white overflow-hidden flex items-center justify-center relative group shadow-inner shrink-0">
              {local.owner_signature_url ? (
                <img
                  src={local.owner_signature_url}
                  alt="Owner Signature Stamp"
                  className="max-w-full max-h-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-3 select-none">
                  <ShieldAlert className="w-6 h-6 text-muted-foreground/60 mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground block">No signature uploaded</span>
                </div>
              )}
            </div>

            {/* Signature Controls */}
            <div className="flex-1 w-full space-y-4">
              {sigMethod === "upload" ? (
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-semibold rounded-lg cursor-pointer active:scale-95 transition-all shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Uploading stamp..." : "Upload Signature Stamp"}
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="sr-only"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>

                  {local.owner_signature_url && (
                    <div className="flex items-center gap-3 ml-1">
                      <button
                        type="button"
                        onClick={handleRotateExistingSignature}
                        disabled={uploading}
                        className="flex items-center gap-1.5 text-xs text-accent hover:underline font-medium disabled:opacity-50"
                      >
                        <RotateCw className="w-3.5 h-3.5" /> Rotate 90°
                      </button>
                      <button
                        type="button"
                        onClick={() => upd("owner_signature_url", null)}
                        className="flex items-center gap-1.5 text-xs text-destructive hover:underline font-medium"
                      >
                        <X className="w-3.5 h-3.5" /> Clear stamp
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">PNG, JPG or WEBP formats. Maximum size: 2MB.</p>
                </div>
              ) : (
                <div className="space-y-3 max-w-lg">
                  <SignaturePad
                    onSave={(blob) => setDrawnBlob(blob)}
                    placeholder="Draw your landlord signature here"
                    existingSignatureUrl={local.owner_signature_url}
                  />
                  {drawnBlob && (
                    <button
                      type="button"
                      onClick={handleSaveDrawnSignature}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {uploading ? "Saving signature..." : "Save Drawn Signature"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Agreement Document Preview */}
        <div className="border-t border-border pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Live Agreement Template Preview
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                Review how the document layout dynamically populates. You can view the instant HTML layout, or render the exact PDF.
              </p>
            </div>
            
            {/* Preview Toggle Tabs */}
            <div className="flex gap-2 p-1 bg-secondary/50 border border-border/80 rounded-xl text-[11px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setPreviewTab("html")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  previewTab === "html"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                HTML Layout
              </button>
              <button
                type="button"
                onClick={generatePdfPreview}
                disabled={loadingPdf}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                  previewTab === "pdf"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {loadingPdf ? (
                  <RotateCw className="w-3 h-3 animate-spin text-accent" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                Exact PDF Document
              </button>
            </div>
          </div>

          {previewTab === "html" ? (
            <div className="rounded-xl border border-border bg-slate-50/50 p-5 space-y-4 max-h-[450px] overflow-y-auto text-xs leading-relaxed text-slate-700 select-none shadow-inner">
              <div className="text-center border-b border-border/80 pb-3 mb-3">
                <h4 className="font-bold text-sm tracking-tight text-slate-800 uppercase">
                  {local.title || "Standard Tenant Agreement"}
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Hostel: (Hostel Name)
                </p>
              </div>

              <p>
                This agreement is made and entered into by and between the Hostel Management of <strong>(Hostel Name)</strong> (represented by Authorized Signatory <strong>{local.owner_name || "(Signatory Name)"}</strong>) and the Tenant <strong>(Tenant Name)</strong>.
              </p>

              <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-800 mt-3 mb-1">
                1. Room & Financial Summary
              </h5>
              <div className="bg-white rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] border border-border">
                <div>
                  <span className="text-muted-foreground">Assigned Room:</span>{" "}
                  <strong className="text-slate-800">(Room No.)</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Joining Date:</span>{" "}
                  <strong className="text-slate-800">(Joining Date)</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Monthly Rent:</span>{" "}
                  <strong className="text-slate-800">₹(Monthly Rent)</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Security Deposit:</span>{" "}
                  <strong className="text-slate-800">₹(Deposit)</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Cycle:</span>{" "}
                  <strong className="text-slate-800">(Payment Frequency)</strong>
                </div>
              </div>

              <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-800 mt-4 mb-1">
                2. Terms of Residency & Rules Compliance
              </h5>
              <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground">
                <li>The Tenant shall use the allocated room solely for residential purposes. Sub-letting or transferring the room to any other person is strictly prohibited.</li>
                <li>The Tenant agrees to pay the monthly rent on or before the due date as defined by the hostel policy. Late payments may attract fees or lead to suspension of access.</li>
                <li>A refundable security deposit is deposited with the management, which will be settled/refunded upon successful move-out compliance checks, subject to clearance of all pending dues and room inspection for damages.</li>
                <li>Either party must provide at least 30 days written notice prior to terminating this residency agreement.</li>
                <li className="text-slate-800 font-medium bg-amber-500/5 p-2 rounded border border-amber-500/10">
                  <strong>Hostel Rules Binding Clause:</strong> The Tenant explicitly agrees to follow, comply with, and be legally bound by each and every rule, policy, and regulation of the hostel. This includes all guidelines concerning fee refunds, hostel discipline, guest policies, late fee obligations, and property damage liabilities. Any breach of these rules constitutes a violation of this residency agreement and may result in immediate termination of stay.
                </li>
              </ul>

              {local.hostel_rules?.categories && (
                <>
                  <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-800 mt-4 mb-1">
                    3. Hostel Rules & Regulations
                  </h5>
                  <div className="space-y-4 pl-2 text-[11px] text-muted-foreground border-l-2 border-slate-100 ml-1">
                    {local.hostel_rules.categories.map((category: any, cIdx: number) => (
                      <div key={category.id || cIdx} className="space-y-1">
                        <h6 className="font-bold text-slate-800">{category.title}</h6>
                        <ul className="list-disc pl-4 space-y-1">
                          {(category.highlights || []).map((hl: string, idx: number) => (
                            <li key={`hl-${idx}`} className="italic text-foreground font-medium">
                              {hl}
                            </li>
                          ))}
                          {(category.rules || []).map((rule: string, idx: number) => (
                            <li key={`rule-${idx}`}>
                              {rule}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {local.custom_rules && (
                <>
                  <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-800 mt-4 mb-1">
                    4. Additional Custom Rules
                  </h5>
                  <p className="whitespace-pre-line text-muted-foreground bg-amber-50/20 border border-amber-500/10 rounded-lg p-3 italic">
                    {local.custom_rules}
                  </p>
                </>
              )}

              <div className="pt-4 border-t border-dashed border-border/80 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Tenant Signature</span>
                  <div className="w-32 h-12 border border-dashed border-border rounded-lg bg-white flex items-center justify-center text-[10px] text-muted-foreground">
                    (Tenant to sign)
                  </div>
                </div>

                <div className="space-y-1 text-right flex flex-col items-end">
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Landlord Signature</span>
                  <div className="w-32 h-12 border border-dashed border-border rounded-lg bg-white overflow-hidden flex items-center justify-center relative">
                    {local.owner_signature_url ? (
                      <img
                        src={local.owner_signature_url}
                        alt="Owner Signature"
                        className="max-w-full max-h-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-[9px] text-destructive font-medium">Pending signature</span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 mt-1">{local.owner_name || "(Signatory Name)"}</span>
                </div>
              </div>

              <p className="text-[9px] text-muted-foreground mt-4 pt-3 border-t border-border/60">
                This electronic document is valid under the Information Technology Act. Digital signatures and IP details collected during onboarding are legally binding.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-slate-100 p-2 overflow-hidden shadow-inner flex flex-col items-center justify-center">
              {pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#toolbar=0&navpanes=0`}
                  className="w-full h-[550px] rounded-lg border border-border bg-white"
                  title="PDF Live Preview"
                />
              ) : (
                <div className="py-20 text-center">
                  <RotateCw className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground font-semibold">Generating exact PDF preview...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
