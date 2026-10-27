"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const apiBase = "/api";

export default function CompleteProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    collegeId: "",
    trustName: "",
    registrationYear: new Date().getFullYear().toString(),
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
    principalName: "",
    principalEmail: "",
    principalPhone: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const csrfRes = await fetch(`${apiBase}/auth/csrf-token`, { credentials: "include" });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          setCsrfToken(csrfData.csrfToken);
        }

        const profileRes = await fetch(`${apiBase}/institution/profile`, { credentials: "include" });
        if (!profileRes.ok) {
          router.push("/");
          return;
        }

        const data = await profileRes.json();
        const inst = data.institution;

        // If already completed, redirect to dashboard
        if (inst?.profileCompleted) {
          router.push("/institution/dashboard");
          return;
        }

        // Prefill existing data
        setFormData({
          name: inst?.name || "",
          collegeId: inst?.collegeId || data?.user?.userId || "",
          trustName: inst?.trustName || "",
          registrationYear: inst?.registrationYear?.toString() || new Date().getFullYear().toString(),
          email: inst?.email || "",
          phone: inst?.phone || inst?.contactNumber || "",
          address: inst?.address || "",
          city: inst?.city || inst?.district || "",
          state: inst?.state || "",
          pinCode: inst?.pinCode || inst?.pincode || "",
          principalName: inst?.principalName || "",
          principalEmail: inst?.principalEmail || inst?.email || "",
          principalPhone: inst?.principalPhone || inst?.contactNumber || "",
        });
      } catch (err) {
        console.error("Error loading institution profile for onboarding:", err);
        setError("Failed to load institution details. Please refresh or try again.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Client-side validations
    if (!formData.trustName.trim()) {
      setError("Trust / Society Name is required.");
      return;
    }
    if (!formData.registrationYear || isNaN(Number(formData.registrationYear))) {
      setError("Valid Registration Year is required.");
      return;
    }
    if (!formData.phone.trim()) {
      setError("Institution Phone Number is required.");
      return;
    }
    if (!formData.address.trim()) {
      setError("Full Address is required.");
      return;
    }
    if (!formData.city.trim()) {
      setError("City is required.");
      return;
    }
    if (!formData.state.trim()) {
      setError("State is required.");
      return;
    }
    if (!formData.pinCode.trim()) {
      setError("PIN Code is required.");
      return;
    }
    if (!formData.principalName.trim()) {
      setError("Principal Name is required.");
      return;
    }
    if (!formData.principalEmail.trim() || !formData.principalEmail.includes("@")) {
      setError("A valid Principal Email is required.");
      return;
    }
    if (!formData.principalPhone.trim()) {
      setError("Principal Phone Number is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/institution/complete-profile`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({
          ...formData,
          registrationYear: Number(formData.registrationYear),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "Failed to complete profile.");
      }

      setSuccess("Profile completed successfully! Redirecting to Dashboard...");
      setTimeout(() => {
        router.push("/institution/dashboard");
      }, 1200);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving profile.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Preparing onboarding profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 px-2">
      {/* Onboarding Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-amber-400 text-blue-950 text-xs font-black uppercase px-2.5 py-1 rounded-full tracking-wide">
            Mandatory Step
          </span>
          <span className="text-blue-200 text-xs font-semibold">
            First-Time Institutional Onboarding
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Complete Institution Profile
        </h1>
        <p className="text-blue-200 text-sm mt-2 max-w-2xl leading-relaxed">
          Welcome to the AICTE Unified Portal. Please complete and confirm your institutional registration details below to activate full access to your Institution Dashboard and council services.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-sm font-medium flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-medium flex items-center gap-3">
          <span className="text-lg">✅</span>
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: Institution Details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>🏛️</span> Institution Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Primary institutional identity and society affiliation</p>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Institution Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Full Institution Name"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>College ID</span>
                <span className="text-[10px] text-slate-400 font-semibold normal-case">(Read-only system ID)</span>
              </label>
              <input
                type="text"
                name="collegeId"
                value={formData.collegeId}
                readOnly
                disabled
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-600 font-mono cursor-not-allowed select-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Trust / Society Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                name="trustName"
                value={formData.trustName}
                onChange={handleChange}
                required
                placeholder="e.g. National Educational Society"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Registration Year <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                name="registrationYear"
                min="1900"
                max={new Date().getFullYear()}
                value={formData.registrationYear}
                onChange={handleChange}
                required
                placeholder="e.g. 2012"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Contact Information */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>📞</span> Contact Information
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Official communication channels for AICTE notices</p>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Official Email <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="contact@college.edu"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Phone Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="e.g. 011-23456789 or 9876543210"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Address */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>📍</span> Address
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Physical campus location registered with AICTE</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Full Address <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="Campus street address, campus area"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  City <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Pune"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  State <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Maharashtra"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  PIN Code <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="pinCode"
                  value={formData.pinCode}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 411001"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Principal Details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>👤</span> Principal Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Head of institution contact information</p>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Principal Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                name="principalName"
                value={formData.principalName}
                onChange={handleChange}
                required
                placeholder="Dr. John Doe"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Principal Email <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                name="principalEmail"
                value={formData.principalEmail}
                onChange={handleChange}
                required
                placeholder="principal@college.edu"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Principal Phone Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                name="principalPhone"
                value={formData.principalPhone}
                onChange={handleChange}
                required
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="text-xs text-slate-500 font-medium">
            Fields marked with <span className="text-rose-600 font-bold">*</span> are mandatory for AICTE compliance.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm rounded-xl transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <span>Complete Profile & Access Dashboard</span>
                <span>➔</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
