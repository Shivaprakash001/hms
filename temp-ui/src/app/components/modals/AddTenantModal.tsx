import { useState } from 'react';
import { X, Upload, User, Phone, Building2, GraduationCap, MapPin, Users as UsersIcon } from 'lucide-react';

interface AddTenantModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function AddTenantModal({ onClose, onSubmit }: AddTenantModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    aadhaar: '',
    phone: '',
    college: '',
    rollNumber: '',
    yearOfStudy: '',
    hometown: '',
    guardianName: '',
    guardianPhone: '',
    roomNumber: '',
    joiningDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Add New Tenant</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Tenant Photo</label>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Tap to upload photo</p>
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-accent" />
              Personal Information
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Aadhaar Number *</label>
              <input
                type="text"
                required
                maxLength={12}
                value={formData.aadhaar}
                onChange={(e) => handleChange('aadhaar', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="1234 5678 9012"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Phone Number *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Hometown</label>
              <input
                type="text"
                value={formData.hometown}
                onChange={(e) => handleChange('hometown', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="City, State"
              />
            </div>
          </div>

          {/* Academic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-accent" />
              Academic Information
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">College/University *</label>
              <input
                type="text"
                required
                value={formData.college}
                onChange={(e) => handleChange('college', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter college name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Roll Number</label>
                <input
                  type="text"
                  value={formData.rollNumber}
                  onChange={(e) => handleChange('rollNumber', e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Roll no."
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Year of Study</label>
                <select
                  value={formData.yearOfStudy}
                  onChange={(e) => handleChange('yearOfStudy', e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Select</option>
                  <option value="1st">1st Year</option>
                  <option value="2nd">2nd Year</option>
                  <option value="3rd">3rd Year</option>
                  <option value="4th">4th Year</option>
                  <option value="5th">5th Year</option>
                </select>
              </div>
            </div>
          </div>

          {/* Guardian Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-accent" />
              Guardian Details
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Guardian Name *</label>
              <input
                type="text"
                required
                value={formData.guardianName}
                onChange={(e) => handleChange('guardianName', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Parent/Guardian name"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Guardian Phone *</label>
              <input
                type="tel"
                required
                value={formData.guardianPhone}
                onChange={(e) => handleChange('guardianPhone', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          {/* Room Allocation */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" />
              Room Allocation
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Room Number *</label>
                <input
                  type="text"
                  required
                  value={formData.roomNumber}
                  onChange={(e) => handleChange('roomNumber', e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g. 204"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Joining Date *</label>
                <input
                  type="date"
                  required
                  value={formData.joiningDate}
                  onChange={(e) => handleChange('joiningDate', e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform"
          >
            Add Tenant
          </button>
        </form>
      </div>
    </div>
  );
}
