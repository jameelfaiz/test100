"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Building2,
  CheckCircle2,
  Search,
  UploadCloud,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  AlertCircle,
} from "lucide-react";

interface InstitutionItem {
  _id: string;
  name: string;
  collegeId: string;
  state?: string;
  district?: string;
  address?: string;
}

const CATEGORIES = [
  "Academic Issues",
  "Fee-Related Issues",
  "Institutional Misconduct",
  "Regulatory Violations",
  "Financial Irregularities",
  "Fraud or Corruption",
  "Other Complaints",
];

export default function PublicComplaintPage() {
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [complainantName, setComplainantName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState<{
    referenceNumber: string;
    department: string;
  } | null>(null);

  // Fetch actual registered institutions from MongoDB
  useEffect(() => {
    async function loadInstitutions() {
      try {
        const res = await fetch("/api/public/institutions");
        if (res.ok) {
          const data = await res.json();
          setInstitutions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Error loading institutions:", err);
      } finally {
        setLoadingInstitutions(false);
      }
    }
    loadInstitutions();
  }, []);

  // When an institution is selected, auto-fill College ID, State, and District
  const handleInstitutionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedInstitutionId(id);
    const inst = institutions.find((i) => i._id === id || i.collegeId === id);
    if (inst) {
      setCollegeId(inst.collegeId || "");
      setState(inst.state || "");
      setDistrict(inst.district || "");
    } else {
      setCollegeId("");
      setState("");
      setDistrict("");
    }
  };

  const filteredInstitutions = institutions.filter(
    (i) =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.collegeId && i.collegeId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!complainantName.trim() || !email.trim() || !mobile.trim()) {
      setErrorMsg("Please enter your name, email, and mobile number.");
      return;
    }
    if (!selectedInstitutionId) {
      setErrorMsg("Please select an institution from the registered list.");
      return;
    }
    if (!subject.trim() || !description.trim()) {
      setErrorMsg("Please provide a complaint subject and detailed description.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complainantName: complainantName.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          institutionId: selectedInstitutionId,
          collegeId,
          state,
          district,
          category,
          subject: subject.trim(),
          description: description.trim(),
          evidenceUrl: evidenceUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit complaint.");
      }

      setSuccessData({
        referenceNumber: data.complaintReference,
        department: data.assignedDepartment || "PGRC",
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Error submitting complaint. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "inherit", color: "#1e293b" }}>
      {/* Top Header */}
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
            <ShieldAlert size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
              AICTE Public Grievance & Vigilance Portal
            </h1>
            <p style={{ margin: 0, fontSize: ".75rem", color: "#94a3b8" }}>
              All India Council for Technical Education • Statutory Redressal Mechanism
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/public/track"
            style={{
              color: "#38bdf8",
              fontSize: ".875rem",
              fontWeight: 600,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Search size={14} /> Track Existing Complaint
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
            Employee Login →
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 900, margin: "32px auto", padding: "0 16px" }}>
        {/* Success View */}
        {successData ? (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: 36,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                backgroundColor: "#ecfdf5",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={36} color="#059669" />
            </div>

            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#065f46", margin: "0 0 8px" }}>
              Your complaint has been submitted successfully.
            </h2>
            <p style={{ color: "#475569", fontSize: ".9375rem", maxWidth: 540, margin: "0 auto 24px" }}>
              Your grievance has been officially registered in the AICTE central registry. Authorized officers will review the matter in accordance with statutory regulations.
            </p>

            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "2px dashed #cbd5e1",
                borderRadius: 8,
                padding: "20px 24px",
                display: "inline-block",
                marginBottom: 28,
              }}
            >
              <span style={{ fontSize: ".75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", display: "block" }}>
                Unique Complaint Reference Number
              </span>
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "#1e3a8a",
                  letterSpacing: "0.02em",
                  fontFamily: "monospace",
                  display: "block",
                  marginTop: 4,
                }}
              >
                {successData.referenceNumber}
              </span>
              <span style={{ fontSize: ".75rem", color: "#059669", display: "block", marginTop: 4 }}>
                Routed Department: <strong>{successData.department}</strong>
              </span>
            </div>

            <p style={{ fontSize: ".8125rem", color: "#64748b", marginBottom: 28 }}>
              Please save your reference number. You can check the current investigation progress anytime using your registered email address or mobile number.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
              <Link
                href={`/public/track?ref=${successData.referenceNumber}`}
                style={{
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: 6,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Track Status Now <ArrowRight size={16} />
              </Link>
              <button
                onClick={() => {
                  setSuccessData(null);
                  setSubject("");
                  setDescription("");
                  setEvidenceUrl("");
                }}
                style={{
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  padding: "10px 20px",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Submit Another Complaint
              </button>
            </div>
          </div>
        ) : (
          /* Submission Form */
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "24px 32px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Public Grievance & Allegation Submission Form
              </h2>
              <p style={{ fontSize: ".875rem", color: "#64748b", margin: "4px 0 0" }}>
                Submit a formal complaint concerning an AICTE-approved institution. Submissions are processed by PGRC or Vigilance based on statutory categorization.
              </p>
            </div>

            {errorMsg && (
              <div
                style={{
                  margin: "16px 32px 0",
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

            <form onSubmit={handleSubmit} style={{ padding: "28px 32px" }}>
              {/* Section 1: Complainant Details */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#1e3a8a", margin: "0 0 16px", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
                  1. Complainant Identification
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      Complainant Full Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Ramesh Kumar"
                      value={complainantName}
                      onChange={(e) => setComplainantName(e.target.value)}
                      required
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      className="input"
                      placeholder="e.g. ramesh@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="e.g. 9876543210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Institution Selection (Real MongoDB records) */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#1e3a8a", margin: "0 0 16px", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
                  2. Institution Subject to Complaint
                </h3>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Select Registered Institution *
                  </label>
                  {loadingInstitutions ? (
                    <div style={{ padding: 12, backgroundColor: "#f8fafc", borderRadius: 6, fontSize: ".875rem", color: "#64748b" }}>
                      Loading actual registered institutions from AICTE database...
                    </div>
                  ) : (
                    <div>
                      <select
                        value={selectedInstitutionId}
                        onChange={handleInstitutionSelect}
                        required
                        style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem", backgroundColor: "#fff" }}
                      >
                        <option value="">-- Choose from actual registered institutions --</option>
                        {institutions.map((inst) => (
                          <option key={inst._id} value={inst._id}>
                            {inst.name} ({inst.collegeId}) — {inst.district || ""}, {inst.state || ""}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: ".75rem", color: "#64748b", marginTop: 4, display: "block" }}>
                        Select from genuine registered institutions in MongoDB. Matching uses the immutable College ID.
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      College ID
                    </label>
                    <input
                      type="text"
                      value={collegeId}
                      readOnly
                      placeholder="Auto-populated"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 6, backgroundColor: "#f8fafc", fontSize: ".875rem", color: "#475569" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      State
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      District
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="District"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Grievance Categorization & Details */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#1e3a8a", margin: "0 0 16px", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
                  3. Complaint Details & Allegations
                </h3>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Complaint Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem", backgroundColor: "#fff" }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: ".75rem", color: "#64748b", marginTop: 4, display: "block" }}>
                    Complaints regarding "Fraud or Corruption" and "Financial Irregularities" are routed directly to the Vigilance Division.
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Complaint Subject *
                  </label>
                  <input
                    type="text"
                    placeholder="Brief subject of the complaint (e.g. Mandatory fee overcharging in violation of norms)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Detailed Description *
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Provide specific dates, facts, incident particulars, and names of individuals involved..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: ".8125rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Supporting Evidence Document Reference / File Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. bank_receipt_complaint.pdf or evidence_document_2026.pdf"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: ".875rem" }}
                  />
                  <span style={{ fontSize: ".75rem", color: "#64748b", marginTop: 4, display: "block" }}>
                    Specify document name or uploaded evidence reference.
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: "#1e3a8a",
                    color: "#ffffff",
                    padding: "12px 28px",
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: ".9375rem",
                    border: "none",
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 4px rgba(30, 58, 138, 0.2)",
                  }}
                >
                  {submitting ? "Submitting to Central Registry..." : "Submit Complaint"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
