"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Calendar,
  FileCheck2,
  RotateCcw,
  Home,
  ExternalLink,
  ShieldCheck,
  FileText,
  Info,
} from "lucide-react";

interface TrackingDetails {
  complaintReference: string;
  department: string;
  subject: string;
  institutionName: string;
  submissionDate: string;
  status: "Submitted" | "Under Review" | "Investigation" | "Proven" | "Unproven" | "Closed" | string;
  rawStatus?: string;
  lastUpdated: string;
  publicRemarks: string;
}

export default function TrackPgrcComplaintPage() {
  const [complaintReference, setComplaintReference] = useState("");
  const [email, setEmail] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [trackingResult, setTrackingResult] = useState<TrackingDetails | null>(null);

  // Pre-fill query params if present in URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      const mail = params.get("email");
      if (ref) setComplaintReference(ref);
      if (mail) setEmail(mail);
    }
  }, []);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setTrackingResult(null);

    const cleanRef = complaintReference.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanRef) {
      setErrorMessage("Please enter your Complaint Tracking Number.");
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter your registered Complainant Email Address.");
      return;
    }

    try {
      setTrackingLoading(true);
      const res = await fetch("/api/public/complaints/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintReference: cleanRef,
          email: cleanEmail,
          department: "PGRC",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "No complaint record found matching the provided Tracking Number and Email Address.");
      }

      setTrackingResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || "No complaint record found matching the provided Tracking Number and Email Address.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleReset = () => {
    setComplaintReference("");
    setEmail("");
    setErrorMessage("");
    setTrackingResult(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Submitted":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Under Review":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Investigation":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Proven":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Unproven":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Closed":
        return "bg-slate-200 text-slate-800 border-slate-300";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-900/60 transition-colors"
            >
              <ShieldAlert size={15} />
              <span>Raise Grievance</span>
            </Link>
            <Link
              href="/complaints/pgrc/track"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-900 shadow-inner"
            >
              <Search size={15} />
              <span>Track Grievance</span>
            </Link>
            <Link
              href="/complaints/vigilance/track"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-300 hover:text-amber-200 hover:bg-blue-900/60 transition-colors ml-2"
            >
              <span>Vigilance Tracking</span>
              <ExternalLink size={13} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Informational Guidance Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start text-blue-900">
          <Info size={20} className="text-blue-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="font-semibold block mb-0.5 text-blue-950">
              Grievance Status Tracking:
            </strong>
            Enter your unique Complaint Tracking Number and registered Email Address to view the official procedural status of your grievance.
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 items-start text-rose-900">
            <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">{errorMessage}</div>
          </div>
        )}

        {/* Tracking Input Card */}
        {!trackingResult ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900">Track Grievance Status</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your Tracking Number and registered Email Address to view current inquiry status.
              </p>
            </div>

            <form onSubmit={handleTrack} className="space-y-4">
              {/* Field 1: Complaint Tracking Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Complaint Tracking Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={complaintReference}
                  onChange={(e) => setComplaintReference(e.target.value.toUpperCase())}
                  placeholder="e.g. PGRC-2026-847291"
                  className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                />
              </div>

              {/* Field 2: Registered Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="complainant@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={trackingLoading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
                >
                  <Search size={15} />
                  <span>{trackingLoading ? "Retrieving Status..." : "Track Complaint"}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Tracking Result Card */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Grievance Record
                </span>
                <h2 className="text-2xl font-bold font-mono text-blue-950 mt-0.5">
                  {trackingResult.complaintReference}
                </h2>
              </div>
              <span
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusBadge(
                  trackingResult.status
                )}`}
              >
                {trackingResult.status}
              </span>
            </div>

            {/* Grid of Safe Public Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs font-semibold text-slate-500 uppercase">Department</div>
                <div className="text-sm font-bold text-slate-900">{trackingResult.department} Cell</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs font-semibold text-slate-500 uppercase">Target Institution</div>
                <div className="text-sm font-bold text-slate-900">{trackingResult.institutionName}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs font-semibold text-slate-500 uppercase">Submission Date</div>
                <div className="text-sm font-medium text-slate-800">
                  {new Date(trackingResult.submissionDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs font-semibold text-slate-500 uppercase">Last Registry Update</div>
                <div className="text-sm font-medium text-slate-800">
                  {new Date(trackingResult.lastUpdated).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="text-xs font-semibold text-slate-500 uppercase">Grievance Subject</div>
              <div className="text-sm font-medium text-slate-900">{trackingResult.subject}</div>
            </div>

            {/* Public Status Remarks */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
              <div className="text-xs font-semibold text-blue-900 uppercase">Official Status Remarks</div>
              <p className="text-sm text-blue-950 leading-relaxed">{trackingResult.publicRemarks}</p>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
              <Link
                href="/complaints/pgrc"
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                ← Raise New Grievance
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
              >
                <RotateCcw size={14} />
                <span>Track Another Grievance</span>
              </button>
            </div>
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
