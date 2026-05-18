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
    totalFloors: '',
    totalRooms: '',
    contactNumber: '',
  });
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => ownerService.createHostel(payload),
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
      name: formData.hostelName,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      total_floors: formData.totalFloors ? Number(formData.totalFloors) : undefined,
      total_rooms: formData.totalRooms ? Number(formData.totalRooms) : undefined,
      phone: formData.contactNumber,
    });
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
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Tap to upload hostel photo</p>
            </div>
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
                placeholder="e.g. NIVĀ Koramangala"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Total Floors *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.totalFloors}
                  onChange={(e) => handleChange('totalFloors', e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Total Rooms *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.totalRooms}
                  onChange={(e) => handleChange('totalRooms', e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Location Details */}
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
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : 'Create Hostel'}
          </button>
        </form>
      </div>
    </div>
  );
}
