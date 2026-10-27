"use client";

import React, { useState, useEffect } from "react";

const apiBase = "/api";

interface InstitutionProfile {
  _id: string;
  name: string;
  collegeId: string;
  registrationStatus: string;
  email?: string;
  phone?: string;
  contactNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  pinCode?: string;
  principalName?: string;
  principalEmail?: string;
  principalPhone?: string;
  trustName?: string;
  registrationYear?: number | string;
  applicationYear?: string;
  aicteApprovalNumber?: string;
  profileCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<InstitutionProfile | null>(null);
  const [user, setUser] = useState<{ userId: string; role: string; accountStatus: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  // Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

  const loadProfile = async () => {
    try {
      const csrfRes = await fetch(`${apiBase}/auth/csrf-token`, { credentials: "include" });
      if (csrfRes.ok) {
        const csrfData = await csrfRes.json();
        setCsrfToken(csrfData.csrfToken);
      }

      const res = await fetch(`${apiBase}/institution/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load profile");
      const d = await res.json();
      setProfile(d.institution);
      setUser(d.user);
    } catch {
      setError("Failed to load profile. Please check your session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const openEditModal = () => {
    if (!profile) return;
    setEditFormData({
      name: profile.name || "",
      trustName: profile.trustName || "",
      registrationYear: profile.registrationYear || profile.applicationYear || new Date().getFullYear(),
      phone: profile.phone || profile.contactNumber || "",
      address: profile.address || "",
      city: profile.city || "",
      state: profile.state || "",
      pinCode: profile.pinCode || profile.pincode || "",
      principalName: profile.principalName || "",
      principalEmail: profile.principalEmail || profile.email || "",
      principalPhone: profile.principalPhone || profile.phone || profile.contactNumber || "",
    });
    setSaveError("");
    setSaveSuccess("");
    setIsEditing(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const res = await fetch(`${apiBase}/institution/profile`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify(editFormData),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "Failed to update profile");
      }

      setSaveSuccess("Profile updated successfully!");
      setProfile(resData.institution);
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccess("");
      }, 1000);
    } catch (err: any) {
      setSaveError(err.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading profile...</div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">{error}</div>
  );

  if (!profile) return null;

  const STATUS_COLORS: Record<string, string> = {
    VERIFIED: "bg-green-100 text-green-800",
    PENDING_VERIFICATION: "bg-yellow-100 text-yellow-800",
    ACTIVE: "bg-green-100 text-green-800",
    APPROVED: "bg-green-100 text-green-800",
    SUSPENDED: "bg-red-100 text-red-800",
  };

  const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="flex py-3 border-b border-slate-100 last:border-0">
      <dt className="w-48 shrink-0 text-xs font-semibold text-slate-500 uppercase tracking-wide pt-0.5">{label}</dt>
      <dd className="text-sm text-slate-800 flex-1 font-medium">{value ? String(value) : <span className="text-slate-400 italic">Not provided</span>}</dd>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Institution Profile</h1>
          <p className="text-slate-500 text-sm mt-1">Registration details and official council records for your institution.</p>
        </div>
        <button
          onClick={openEditModal}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition shadow flex items-center gap-2"
        >
          <span>✏️</span>
          <span>Edit Profile</span>
        </button>
      </div>

      {/* Identity Card */}
      <div className="bg-blue-950 rounded-xl p-6 text-white shadow">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold">{profile.name}</div>
            <div className="text-blue-200 font-mono text-sm mt-1">College ID: {profile.collegeId}</div>
            {profile.aicteApprovalNumber && (
              <div className="text-blue-200 text-sm">AICTE Approval No.: {profile.aicteApprovalNumber}</div>
            )}
          </div>
          <div className="text-right">
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[profile.registrationStatus] || "bg-slate-100 text-slate-700"}`}>
              {profile.registrationStatus?.replace(/_/g, " ")}
            </span>
            {user && (
              <div className="text-blue-300 text-xs mt-2">Account: {user.accountStatus?.replace(/_/g, " ")}</div>
            )}
          </div>
        </div>
      </div>

      {/* Details Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Institution Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-slate-50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">🏛️ Institution Details</h2>
          </div>
          <dl className="px-6 py-2">
            <InfoRow label="Institution Name" value={profile.name} />
            <InfoRow label="College ID" value={profile.collegeId} />
            <InfoRow label="Trust / Society" value={profile.trustName} />
            <InfoRow label="Registration Year" value={profile.registrationYear || profile.applicationYear} />
            <InfoRow label="Status" value={profile.registrationStatus?.replace(/_/g, " ")} />
          </dl>
        </div>

        {/* Contact Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-slate-50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">📞 Contact Information</h2>
          </div>
          <dl className="px-6 py-2">
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Phone" value={profile.phone || profile.contactNumber} />
          </dl>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-slate-50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">📍 Address</h2>
          </div>
          <dl className="px-6 py-2">
            <InfoRow label="Address" value={profile.address} />
            <InfoRow label="City" value={profile.city} />
            <InfoRow label="State" value={profile.state} />
            <InfoRow label="PIN Code" value={profile.pinCode || profile.pincode} />
          </dl>
        </div>

        {/* Principal / Contact Person */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-slate-50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">👤 Principal Details</h2>
          </div>
          <dl className="px-6 py-2">
            <InfoRow label="Principal Name" value={profile.principalName} />
            <InfoRow label="Principal Email" value={profile.principalEmail} />
            <InfoRow label="Principal Phone" value={profile.principalPhone} />
          </dl>
        </div>
      </div>

      {/* Registration Timestamps */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">📅 Registration History</h2>
        </div>
        <dl className="px-6 py-2">
          <InfoRow label="Registered On" value={new Date(profile.createdAt).toLocaleString("en-IN")} />
          <InfoRow label="Last Updated" value={new Date(profile.updatedAt).toLocaleString("en-IN")} />
          <InfoRow label="MongoDB ID" value={profile._id} />
        </dl>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>✏️</span> Edit Institution Profile
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {saveError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-lg">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-lg">
                {saveSuccess}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Institution Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trust / Society</label>
                  <input
                    type="text"
                    name="trustName"
                    value={editFormData.trustName}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Registration Year</label>
                  <input
                    type="number"
                    name="registrationYear"
                    value={editFormData.registrationYear}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Institution Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={editFormData.phone}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Address</label>
                <input
                  type="text"
                  name="address"
                  value={editFormData.address}
                  onChange={handleEditChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={editFormData.city}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">State</label>
                  <input
                    type="text"
                    name="state"
                    value={editFormData.state}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">PIN Code</label>
                  <input
                    type="text"
                    name="pinCode"
                    value={editFormData.pinCode}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Principal Name</label>
                  <input
                    type="text"
                    name="principalName"
                    value={editFormData.principalName}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Principal Email</label>
                  <input
                    type="email"
                    name="principalEmail"
                    value={editFormData.principalEmail}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Principal Phone</label>
                  <input
                    type="tel"
                    name="principalPhone"
                    value={editFormData.principalPhone}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
