import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { X, Building2, MapPin, Hash, Loader2, Upload } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { queryKeys } from '@lib/queryKeys';

interface AddHostelModalProps {
  onClose: () => void;
}

export function AddHostelModal({ onClose }: AddHostelModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    hostelName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactNumber: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: { data: Record<string, unknown>; file: File | null }) => {
      const result = await ownerService.createHostel(payload.data);
      const anyData = result as Record<string, unknown>;
      const newId = anyData?.id ?? (anyData?.hostel as Record<string, unknown>)?.id;
      
      if (payload.file && newId) {
        try {
          await ownerService.uploadLogo(payload.file, newId);
        } catch (uploadError) {
          console.error('[AddHostelModal] Photo upload failed:', uploadError);
          toast.error('Hostel created, but photo upload failed. You can upload it from settings.');
        }
      }
      return result;
    },
    onSuccess: (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.owner.hostels() });
      toast.success('Hostel created successfully');
      onClose();
      const anyData = data as Record<string, unknown>;
      const newId = anyData?.id ?? (anyData?.hostel as Record<string, unknown>)?.id;
      if (newId) navigate(`/hostels/${newId}`);
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { message?: string; error?: { message?: string } } } })?.response?.data?.message ||
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (error as { message?: string })?.message ||
        'Failed to create hostel';
      setApiError(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    mutation.mutate({
      data: {
        name: formData.hostelName,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        phone: formData.contactNumber,
      },
      file: selectedFile,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size exceeds 2MB limit');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Create New Hostel</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Hostel Photo</label>
            <input
              type="file"
              id="hostel-photo-input"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            {previewUrl ? (
              <div className="relative border border-border rounded-xl overflow-hidden aspect-video max-h-48 group">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById('hostel-photo-input')?.click()}
                    className="p-2 bg-background/90 hover:bg-background rounded-lg text-foreground transition-colors text-xs font-medium flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-2 bg-destructive/90 hover:bg-destructive rounded-lg text-destructive-foreground transition-colors text-xs font-medium flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => document.getElementById('hostel-photo-input')?.click()}
                className="border-2 border-dashed border-border hover:border-accent/50 rounded-xl p-8 text-center cursor-pointer transition-colors bg-card hover:bg-secondary/20"
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Tap to upload hostel photo</p>
                <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, or WEBP up to 2MB</p>
              </div>
            )}
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" />
              Basic Information
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Hostel Name *</label>
              <input
                type="text"
                required
                value={formData.hostelName}
                onChange={(e) => handleChange('hostelName', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g. Sri Adithya Boys Hostel"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent" />
              Location Details
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Street Address *</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter full address"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">City *</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">State *</label>
                <input
                  type="text"
                  required
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="State"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Pincode *</label>
              <input
                type="text"
                required
                maxLength={6}
                value={formData.pincode}
                onChange={(e) => handleChange('pincode', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="560001"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Hash className="w-4 h-4 text-accent" />
              Contact Information
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Contact Number *</label>
              <input
                type="tel"
                required
                value={formData.contactNumber}
                onChange={(e) => handleChange('contactNumber', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          {apiError && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">{apiError}</div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              selectedFile ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading Photo...</>
              ) : (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              )
            ) : 'Create Hostel'}
          </button>
        </form>
      </div>
    </div>
  );
}
