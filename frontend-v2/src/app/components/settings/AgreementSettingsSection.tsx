import { useState, useEffect, useRef } from "react";
import { Upload, X, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ownerService } from "@features/owners/api";
import { SectionShell, Field, inp, SkeletonSection } from "./shared";

interface Props {
  hostelId: string;
}

interface TemplateData {
  title: string;
  owner_name: string;
  owner_signature_url: string | null;
  custom_rules: string;
}

export function AgreementSettingsSection({ hostelId }: Props) {
  const [local, setLocal] = useState<TemplateData>({
    title: "Standard Tenant Agreement",
    owner_name: "",
    owner_signature_url: null,
    custom_rules: "",
  });
  const snap = useRef<TemplateData>(local);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load template on mount or hostelId change
  useEffect(() => {
    let active = true;
    const fetchTemplate = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ownerService.getAgreementTemplate(hostelId);
        const data = res?.data ?? res;
        const mapped: TemplateData = {
          title: data?.title || "Standard Tenant Agreement",
          owner_name: data?.owner_name || "",
          owner_signature_url: data?.owner_signature_url || null,
          custom_rules: data?.custom_rules || "",
        };
        if (active) {
          setLocal(mapped);
          snap.current = mapped;
        }
      } catch (err: any) {
        console.error("Failed to load agreement template", err);
        if (active) {
          setError(err?.response?.data?.error?.message || "Failed to load agreement template");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchTemplate();
    return () => {
      active = false;
    };
  }, [hostelId]);

  const isDirty =
    local.title !== snap.current.title ||
    local.owner_name !== snap.current.owner_name ||
    local.custom_rules !== snap.current.custom_rules ||
    local.owner_signature_url !== snap.current.owner_signature_url;

  const handleSave = async () => {
    if (!local.owner_name.trim()) {
      setError("Authorized Signatory Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await ownerService.updateAgreementTemplate(hostelId, {
        title: local.title,
        owner_name: local.owner_name,
        custom_rules: local.custom_rules,
        owner_signature_url: local.owner_signature_url,
      });
      const data = res?.data ?? res;
      const updated: TemplateData = {
        title: data?.title || local.title,
        owner_name: data?.owner_name || local.owner_name,
        owner_signature_url: data?.owner_signature_url || local.owner_signature_url,
        custom_rules: data?.custom_rules || local.custom_rules,
      };
      setLocal(updated);
      snap.current = updated;
      toast.success("Agreement template saved successfully");
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

  const upd = (k: keyof TemplateData, v: string | null) => {
    setLocal((prev) => ({ ...prev, [k]: v }));
  };

  if (loading) {
    return <SkeletonSection />;
  }

  return (
    <SectionShell
      title="Residency Agreement & Template"
      description="Configure default contract templates, custom house rules, and signature stamps for automatic tenant onboarding PDFs."
      isDirty={isDirty}
      saving={saving}
      onSave={handleSave}
      onReset={handleReset}
      error={error}
    >
      <div className="space-y-6">
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

        {/* Custom Rules */}
        <Field
          label="Custom Hostel Rules / Terms & Conditions"
          hint="These rules will be appended to the standard contract terms and displayed to the tenant during onboarding."
        >
          <textarea
            className={`${inp} min-h-[160px] font-mono text-xs leading-relaxed`}
            value={local.custom_rules}
            onChange={(e) => upd("custom_rules", e.target.value)}
            placeholder="E.g.,&#10;1. Monthly rent must be paid on or before the 5th of each calendar month.&#10;2. Security deposit is refundable only upon serving a 30-day notice period.&#10;3. External visitors/guests are not allowed inside rooms after 8:00 PM."
          />
        </Field>

        {/* Signature Stamp Upload */}
        <div className="border-t border-border pt-5 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Owner Signature Stamp
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Upload a high-quality signature stamp or digital signature. This image will be automatically placed in the landlord signature block of all signed tenant agreements. A transparent PNG format is highly recommended.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-2">
            {/* Stamp preview */}
            <div className="w-48 h-24 border border-dashed border-border rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center relative group shadow-sm shrink-0">
              {local.owner_signature_url ? (
                <img
                  src={local.owner_signature_url}
                  alt="Owner Signature Stamp"
                  className="max-w-full max-h-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-3">
                  <ShieldAlert className="w-6 h-6 text-muted-foreground/60 mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground block">No signature stamp uploaded</span>
                </div>
              )}
            </div>

            {/* Stamp Upload controls */}
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-semibold rounded-lg cursor-pointer active:scale-95 transition-all">
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
                <button
                  type="button"
                  onClick={() => upd("owner_signature_url", null)}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:underline font-medium ml-1"
                >
                  <X className="w-3.5 h-3.5" /> Clear stamp
                </button>
              )}

              <p className="text-[10px] text-muted-foreground">PNG, JPG or WEBP formats. Maximum size: 2MB.</p>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
