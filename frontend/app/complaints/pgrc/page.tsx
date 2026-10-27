"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Send,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  ExternalLink,
  Building2,
  User,
  Mail,
  Phone,
  Copy,
  Check,
  Home,
  Info,
} from "lucide-react";

interface InstitutionItem {
  _id: string;
  collegeId: string;
  name: string;
  district?: string;
  state?: string;
}

export default function PublicPgrcComplaintPage() {
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [loadingInsts, setLoadingInsts] = useState<boolean>(true);

  // Form fields
  const [complainantName, setComplainantName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedRef, setCopiedRef] = useState(false);
  const [successData, setSuccessData] = useState<{
    complaintReference: string;
    institutionName: string;
    submittedEmail: string;
  } | null>(null);

  // Load registered institutions
  useEffect(() => {
    async function fetchInstitutions() {
      try {
        const res = await fetch("/api/public/institutions");
        if (res.ok) {
          const data = await res.json();
          setInstitutions(data);
        }
      } catch (err) {
        console.error("Failed to load institutions:", err);
      } finally {
        setLoadingInsts(false);
      }
    }
    fetchInstitutions();
  }, []);

  const handleClear = () => {
    setComplainantName("");
    setEmail("");
    setMobile("");
    setInstitutionId("");
    setSubject("");
    setDescription("");
    setSelectedFile(null);
    setErrorMessage("");
    setSuccessData(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!complainantName.trim()) {
      setErrorMessage("Please enter Complainant Full Name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid Email Address.");
      return;
    }
    if (!mobile.trim()) {
      setErrorMessage("Please enter a valid Mobile Number.");
      return;
    }
    if (!institutionId) {
      setErrorMessage("Please select an institution from the list.");
      return;
    }
    if (!subject.trim()) {
      setErrorMessage("Please enter the grievance subject.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setErrorMessage("Please enter a detailed complaint description (minimum 10 characters).");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("complainantName", complainantName.trim());
      formData.append("email", email.trim().toLowerCase());
      formData.append("mobile", mobile.trim());
      formData.append("institutionId", institutionId);
      formData.append("subject", subject.trim());
      formData.append("description", description.trim());
      if (selectedFile) {
        formData.append("document", selectedFile);
      }

      const res = await fetch("/api/public/complaints/pgrc", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit grievance");
      }

      const ref = data.complaintReference || data.trackingId || data.complaintId;
      setSuccessData({
        complaintReference: ref,
        institutionName: data.institutionName || "Selected Institution",
        submittedEmail: email.trim().toLowerCase(),
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* Top Header — Matching Institution Portal Theme */}
      <header className="bg-blue-950 text-white shadow-md sticky top-0 z-30 border-b border-blue-900">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-md flex items-center justify-center font-bold text-blue-950 text-lg shadow-sm">
              🏛
            </div>
            <div>
              <div className="text-base font-extrabold tracking-wide uppercase leading-tight">
                AICTE Public Grievance Redressal Portal
              </div>
              <div className="text-xs text-blue-200">
                All India Council for Technical Education • Nelson Mandela Marg, New Delhi
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-900/60 transition-colors"
            >
              <Home size={15} />
              <span>Home</span>
            </Link>
            <Link
              href="/complaints/pgrc"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-900 shadow-inner"
            >
              <ShieldAlert size={15} />
              <span>Raise Grievance</span>
            </Link>
            <Link
              href="/complaints/pgrc/track"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-900/60 transition-colors"
            >
              <Search size={15} />
              <span>Track Grievance</span>
            </Link>
            <Link
              href="/complaints/vigilance"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-300 hover:text-amber-200 hover:bg-blue-900/60 transition-colors ml-2"
            >
              <span>Vigilance Portal</span>
              <ExternalLink size={13} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Success Confirmation Card */}
        {successData ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 uppercase tracking-wider mb-2">
                Registration Successful
              </span>
              <h2 className="text-2xl font-bold text-slate-900">Complaint Registered Successfully!</h2>
              <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
                Your grievance has been securely recorded in the official AICTE Registry and forwarded to the Public Grievance Redressal Cell for officer review.
              </p>
            </div>

            {/* Tracking Reference Display Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-md mx-auto text-left shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Your Complaint Tracking Number
              </div>
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                <span className="font-mono text-2xl font-extrabold text-blue-950 tracking-wide">
                  {successData.complaintReference}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(successData.complaintReference)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
                >
                  {copiedRef ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedRef ? "Copied" : "Copy Tracking Number"}</span>
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 space-y-1">
                <div className="text-xs font-semibold text-slate-500">Target Institution</div>
                <div className="text-sm font-medium text-slate-800">{successData.institutionName}</div>
              </div>
            </div>

            <p className="text-xs text-amber-800 font-medium max-w-md mx-auto bg-amber-50 p-3 rounded-lg border border-amber-200">
              Please save your Tracking Number now. You will need your Tracking Number and registered email to check status updates.
            </p>

            {/* Required Action Buttons */}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleCopy(successData.complaintReference)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
              >
                <Copy size={15} />
                <span>{copiedRef ? "Tracking Number Copied!" : "Copy Tracking Number"}</span>
              </button>
              <Link
                href={`/complaints/pgrc/track?ref=${encodeURIComponent(successData.complaintReference)}&email=${encodeURIComponent(successData.submittedEmail)}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
              >
                <Search size={15} />
                <span>Track Complaint</span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg border border-slate-300 transition-colors text-sm"
              >
                <Home size={15} />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Informational Guidance Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start text-blue-900">
              <Info size={20} className="text-blue-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="font-semibold block mb-0.5 text-blue-950">
                  Public Grievance Redressal Cell (PGRC) Guidelines:
                </strong>
                This public facility is provided for students, parents, faculty, and stakeholders to register genuine grievances regarding AICTE approved institutions (infrastructure, admission discrepancies, fee disputes, or academic harassment). Upon submission, a unique tracking number will be issued to track the status.
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 items-start text-rose-900">
                <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">{errorMessage}</div>
              </div>
            )}

            {/* Registration Form Card */}
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl font-bold text-slate-900">Public Grievance Registration</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Fill in all required fields accurately. A unique complaint tracking reference will be generated upon submission.
                </p>
              </div>

              {/* Section 1: Complainant Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  1. Complainant Contact Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Complainant Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={complainantName}
                        onChange={(e) => setComplainantName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required
                      />
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registered Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@domain.com"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    This email address will be required along with your Tracking Number to track status updates.
                  </p>
                </div>
              </div>

              {/* Section 2: Grievance Details */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  2. Grievance Specifics
                </h3>

                {/* Target Institution Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target AICTE Approved Institution <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-3 text-slate-400" />
                    <select
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value)}
                      disabled={loadingInsts}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      <option value="">
                        {loadingInsts ? "Loading official institution registry..." : "-- Select Institution --"}
                      </option>
                      {institutions.map((inst) => (
                        <option key={inst._id} value={inst._id}>
                          {inst.name} ({inst.collegeId || "AICTE Inst"}) {inst.district ? `— ${inst.district}, ${inst.state}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Grievance Subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Non-refund of security deposit / Inadequate lab equipment"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Grievance Description (Minimum 10 characters) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide a comprehensive and factual account of the issue, dates, and relevant details..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  />
                  <div className="text-[11px] text-slate-400 text-right mt-1">
                    {description.length} characters entered
                  </div>
                </div>

                {/* Supporting Document Upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supporting Document (PDF, JPG, or PNG — Optional, Max 10MB)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <Upload size={14} />
                      <span>{selectedFile ? "Change File" : "Choose File"}</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSelectedFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {selectedFile && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        <FileText size={14} className="text-blue-600" />
                        <span className="font-medium truncate max-w-xs">{selectedFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="text-rose-500 hover:text-rose-700 font-bold ml-1"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
                >
                  <RotateCcw size={14} />
                  <span>Reset Form</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
                >
                  <Send size={15} />
                  <span>{submitting ? "Submitting Grievance..." : "Submit Grievance"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-6 border-t border-slate-800 mt-auto text-center">
        All India Council for Technical Education (AICTE) • Public Grievance Redressal Cell • Official Government of India Portal
      </footer>
    </div>
  );
}
