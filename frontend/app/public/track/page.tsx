"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Building2,
  FileText,
  Calendar,
  ArrowLeft,
} from "lucide-react";

function PublicTrackContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") || "";

  const [complaintRef, setComplaintRef] = useState(initialRef);
  const [verificationFactor, setVerificationFactor] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setResult(null);

    if (!complaintRef.trim() || !verificationFactor.trim()) {
      setErrorMsg("Please enter both Complaint Reference Number and Verification Factor (Email or Mobile).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintReference: complaintRef.trim(),
          verificationFactor: verificationFactor.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to find complaint record.");
      }

      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Complaint reference not found or verification mismatch.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusStep = (status: string) => {
    switch (status) {
      case "Received":
        return 1;
      case "Under Review":
        return 2;
      case "Investigation in Progress":
        return 3;
      case "Resolved":
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "inherit", color: "#1e293b" }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: "#0f172a",
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              backgroundColor: "#2563eb",
              borderRadius: "8px",
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
              AICTE Complaint Status Tracking
            </h1>
            <p style={{ margin: 0, fontSize: ".75rem", color: "#94a3b8" }}>
              Public Verification & Progress Portal
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/public/complaint"
            style={{
              color: "#38bdf8",
              fontSize: ".875rem",
              fontWeight: 600,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(56, 189, 248, 0.3)",
            }}
          >
            ← Submit New Complaint
          </Link>
          <Link
            href="/"
            style={{
              color: "#e2e8f0",
              fontSize: ".875rem",
              textDecoration: "none",
              padding: "6px 12px",
            }}
          >
            Employee Login
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
        {/* Track Search Card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
            padding: "28px 32px",
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
            Track Your Complaint Progress
          </h2>
          <p style={{ fontSize: ".875rem", color: "#64748b", margin: "0 0 20px" }}>
            Enter your unique Complaint Reference Number along with your registered email or mobile number to authenticate.
          </p>

          {errorMsg && (
            <div
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#991b1b",
                fontSize: ".875rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={18} /> {errorMsg}
            </div>
          )}

          <form onSubmit={handleTrack}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Complaint Reference Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. COMP-2026-123456"
                  value={complaintRef}
                  onChange={(e) => setComplaintRef(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Email or Mobile Number *
                </label>
                <input
                  type="text"
                  placeholder="Registered email or phone"
                  value={verificationFactor}
                  onChange={(e) => setVerificationFactor(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: "#1e3a8a",
                color: "#fff",
                padding: "10px 24px",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: ".9375rem",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Search size={16} /> {loading ? "Verifying..." : "Track Status"}
            </button>
          </form>
        </div>

        {/* Results View */}
        {result && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
              padding: "28px 32px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #f1f5f9", paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: ".75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                  Complaint Reference
                </span>
                <h3 style={{ fontSize: "1.375rem", fontWeight: 800, color: "#1e3a8a", margin: "2px 0 0", fontFamily: "monospace" }}>
                  {result.complaintReference}
                </h3>
              </div>

              <span
                style={{
                  backgroundColor:
                    result.status === "Resolved"
                      ? "#ecfdf5"
                      : result.status === "Investigation in Progress"
                      ? "#fffbeb"
                      : "#eff6ff",
                  color:
                    result.status === "Resolved"
                      ? "#065f46"
                      : result.status === "Investigation in Progress"
                      ? "#b45309"
                      : "#1e40af",
                  border: `1px solid ${
                    result.status === "Resolved"
                      ? "#a7f3d0"
                      : result.status === "Investigation in Progress"
                      ? "#fde68a"
                      : "#bfdbfe"
                  }`,
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: ".8125rem",
                  fontWeight: 700,
                }}
              >
                {result.status}
              </span>
            </div>

            {/* Stepper Timeline */}
            <div style={{ margin: "24px 0 32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                {["Received", "Under Review", "Investigation in Progress", "Resolved"].map((step, idx) => {
                  const stepNum = idx + 1;
                  const currentStep = getStatusStep(result.status);
                  const isDone = currentStep >= stepNum;
                  const isCurrent = currentStep === stepNum;

                  return (
                    <div key={step} style={{ textAlign: "center", flex: 1, position: "relative", zIndex: 2 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          backgroundColor: isDone ? "#2563eb" : "#e2e8f0",
                          color: isDone ? "#ffffff" : "#64748b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto 8px",
                          fontWeight: 700,
                          fontSize: ".8125rem",
                          border: isCurrent ? "3px solid #bfdbfe" : "none",
                        }}
                      >
                        {isDone ? <CheckCircle2 size={16} /> : stepNum}
                      </div>
                      <span
                        style={{
                          fontSize: ".75rem",
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? "#0f172a" : "#64748b",
                          display: "block",
                        }}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Particulars Card */}
            <div style={{ backgroundColor: "#f8fafc", borderRadius: 8, padding: 18, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <span style={{ fontSize: ".75rem", color: "#64748b", display: "block" }}>Institution</span>
                  <strong style={{ fontSize: ".875rem", color: "#0f172a" }}>{result.institutionName}</strong>
                </div>
                <div>
                  <span style={{ fontSize: ".75rem", color: "#64748b", display: "block" }}>Category</span>
                  <strong style={{ fontSize: ".875rem", color: "#0f172a" }}>{result.category}</strong>
                </div>
                <div>
                  <span style={{ fontSize: ".75rem", color: "#64748b", display: "block" }}>Subject</span>
                  <strong style={{ fontSize: ".875rem", color: "#0f172a" }}>{result.subject}</strong>
                </div>
                <div>
                  <span style={{ fontSize: ".75rem", color: "#64748b", display: "block" }}>Submitted Date</span>
                  <strong style={{ fontSize: ".875rem", color: "#0f172a" }}>
                    {new Date(result.submittedDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ borderLeft: "4px solid #2563eb", padding: "10px 14px", backgroundColor: "#eff6ff", borderRadius: 4 }}>
              <p style={{ margin: 0, fontSize: ".875rem", color: "#1e40af", fontWeight: 500 }}>
                {result.statusDescription}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function PublicTrackPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading Tracking Portal...</div>}>
      <PublicTrackContent />
    </Suspense>
  );
}
