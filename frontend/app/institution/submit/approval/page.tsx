"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const apiBase = "/api";

interface MandatoryDocCategory {
  id: string;
  name: string;
  description: string;
  code: string;
}

const MANDATORY_DOCUMENTS: MandatoryDocCategory[] = [
  { id: "land_docs", code: "DOC-01", name: "Land Ownership Documents / Registered Sale/Lease Deed", description: "Clear title deed registered in the name of the Applicant Society/Trust." },
  { id: "land_use", code: "DOC-02", name: "Land Conversion / Land Use Certificate", description: "Certificate from competent authority converting land to educational use." },
  { id: "building_plan", code: "DOC-03", name: "Approved Building Plan", description: "Sanctioned master plan approved by Town Planning Authority / Municipal Corporation." },
  { id: "occupancy_cert", code: "DOC-04", name: "Building Completion / Occupancy Certificate", description: "Valid Occupancy Certificate issued by the local development authority." },
  { id: "structural_stability", code: "DOC-05", name: "Structural Stability Certificate", description: "Issued by a registered structural engineer certifying National Building Code compliance." },
  { id: "fire_noc", code: "DOC-06", name: "Fire & Life Safety NOC", description: "Valid No Objection Certificate issued by State Fire Services." },
  { id: "barrier_free", code: "DOC-07", name: "Barrier-Free Environment & Ramp/Lift Certificate", description: "Architectural certification for Differently-Abled accessibility norms." },
  { id: "potable_water", code: "DOC-08", name: "Potable Water & Sanitation Certificate", description: "Health & Public Engineering department certificate verifying water testing." },
  { id: "aicte_affidavit", code: "DOC-09", name: "AICTE Prescribed E-Affidavit (Affidavit-1)", description: "Duly notarized e-affidavit on non-judicial stamp paper as per APH norms." },
  { id: "trust_registration", code: "DOC-10", name: "Trust / Society Registration Certificate & MoA", description: "Registered constitution, bylaws, and Memorandum of Association." },
  { id: "audited_financials", code: "DOC-11", name: "Audited Financial Statements (Last 3 Years)", description: "Balance sheet, P&L, and audit reports certified by Chartered Accountant." },
  { id: "faculty_cadre", code: "DOC-12", name: "Faculty Cadre Ratio & Staff Joining Reports", description: "List of qualified faculty, salary statements, and selection committee minutes." }
];

function ApprovalSeekingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const queryAppId = searchParams.get("appId");
  const isNewMode = mode === "new";

  const [csrfToken, setCsrfToken] = useState<string>("");
  const [applicationType, setApplicationType] = useState<"LOA" | "EOA" | "">("");
  const [docState, setDocState] = useState<Record<string, {
    fileName: string;
    originalName: string;
    fileUrl: string;
    uploading?: boolean;
    error?: string;
  }>>({});
  const [appId, setAppId] = useState<string>("");
  const [appStatus, setAppStatus] = useState<string>("NEW APPLICATION / NOT SUBMITTED");
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const csrfRes = await fetch(`${apiBase}/auth/csrf-token`, { credentials: "include" });
        if (csrfRes.ok) {
          const cData = await csrfRes.json();
          setCsrfToken(cData.csrfToken);
        }

        if (isNewMode) {
          // Explicit NEW APPLICATION mode requested — do NOT fetch or populate old applications
          setAppId("");
          setAppStatus("NEW APPLICATION / NOT SUBMITTED");
          setApplicationType("");
          setDocState({});
          setMessage(null);
          return;
        }

        let url = `${apiBase}/institution/approval/current`;
        if (queryAppId) {
          url += `?appId=${encodeURIComponent(queryAppId)}`;
        }

        const res = await fetch(url, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.application) {
            setAppId(data.application.applicationId);
            setAppStatus(data.application.status || "DRAFT");

            // Restore application type if already chosen
            if (data.application.applicationType) {
              const rawType = String(data.application.applicationType).toUpperCase();
              if (rawType === "LOA" || rawType === "EOA") {
                setApplicationType(rawType as "LOA" | "EOA");
              }
            }

            // Restore document categories
            const savedMap: Record<string, any> = {};
            if (Array.isArray(data.application.categoryDocuments)) {
              data.application.categoryDocuments.forEach((item: any) => {
                if (item && item.category) {
                  savedMap[item.category] = {
                    fileName: item.fileName,
                    originalName: item.originalName,
                    fileUrl: item.fileUrl || `/api/institution/files/${item.fileName}`,
                  };
                }
              });
            } else if (Array.isArray(data.application.documents)) {
              data.application.documents.forEach((fName: string, idx: number) => {
                if (MANDATORY_DOCUMENTS[idx]) {
                  savedMap[MANDATORY_DOCUMENTS[idx].id] = {
                    fileName: fName,
                    originalName: fName,
                    fileUrl: `/api/institution/files/${fName}`,
                  };
                }
              });
            }
            setDocState(savedMap);
          } else {
            // No saved draft; start in fresh new application mode
            setAppId("");
            setAppStatus("NEW APPLICATION / NOT SUBMITTED");
            setApplicationType("");
            setDocState({});
          }
        }
      } catch (err) {
        console.error("Failed to load approval application:", err);
      }
    }
    load();
  }, [isNewMode, queryAppId]);

  const handleFileUpload = async (categoryId: string, file: File) => {
    if (!applicationType) {
      setMessage({
        text: "Please select an Application Category (LoA — Letter of Approval or EoA — Extension of Approval) before uploading documents.",
        type: "error",
      });
      return;
    }

    setDocState((prev) => ({
      ...prev,
      [categoryId]: { ...(prev[categoryId] || {}), uploading: true, error: undefined },
    }));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${apiBase}/institution/upload`, {
        method: "POST",
        credentials: "include",
        headers: { "X-XSRF-TOKEN": csrfToken },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");

      setDocState((prev) => ({
        ...prev,
        [categoryId]: {
          fileName: data.fileName,
          originalName: data.originalName,
          fileUrl: data.fileUrl,
          uploading: false,
        },
      }));
    } catch (err: any) {
      setDocState((prev) => ({
        ...prev,
        [categoryId]: { ...(prev[categoryId] || {}), uploading: false, error: err.message },
      }));
    }
  };

  const isSubmitted = appStatus === "SUBMITTED" || appStatus === "APPROVED" || appStatus === "REJECTED";

  const handleSave = async (isDraft: boolean) => {
    setSaving(true);
    setMessage(null);

    if (!applicationType) {
      setMessage({
        text: "Please select an Application Category (LoA — Letter of Approval or EoA — Extension of Approval) before submitting.",
        type: "error",
      });
      setSaving(false);
      return;
    }

    const documents = Object.entries(docState)
      .filter(([_, val]) => val && val.fileName)
      .map(([catId, val]) => ({
        category: catId,
        fileName: val.fileName,
        originalName: val.originalName,
        fileUrl: val.fileUrl,
      }));

    if (!isDraft && documents.length < MANDATORY_DOCUMENTS.length) {
      setMessage({
        text: `Please upload all 12 mandatory documents before final submission (Currently uploaded: ${documents.length}/${MANDATORY_DOCUMENTS.length}).`,
        type: "error",
      });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/institution/approval/save`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({
          applicationId: appId,
          mode: isNewMode && !appId ? "new" : undefined,
          applicationType,
          title: applicationType === "LOA" ? "AICTE Approval Seeking — Letter of Approval (LoA)" : "AICTE Approval Seeking — Extension of Approval (EoA)",
          description: applicationType === "LOA" ? "New institute approval seeking document submission" : "Annual institution compliance and approval seeking document submission",
          documents,
          isDraft,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");

      setAppId(data.application.applicationId);
      setAppStatus(data.application.status);
      setMessage({
        text: isDraft
          ? `Application draft (${applicationType}) saved. Documents and application type are safely preserved in MongoDB.`
          : `Your ${applicationType === "LOA" ? "Letter of Approval (LoA)" : "Extension of Approval (EoA)"} request (${data.application.applicationId}) has been successfully submitted! It is now pending in the AICTE FD Employee verification queue.`,
        type: "success",
      });
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to save application", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const totalUploaded = Object.values(docState).filter((d) => d && d.fileName).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            AICTE Approval Process Handbook Compliance
          </div>
          <h1 className="text-2xl font-extrabold text-blue-950 mt-1">
            Approval Seeking Module (12 Mandatory Categories)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Upload the mandatory documents per AICTE norms. Each document is individually stored, hash-validated, and verified by FD employees.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500">Application Status</div>
            <div className="text-sm font-bold text-blue-900">{appStatus}</div>
            {appId && (
              <div className="text-[10px] text-slate-400 font-mono">Ref: {appId}</div>
            )}
          </div>
          <div className="text-right pl-3 border-l border-slate-200">
            <div className="text-xs text-slate-500">Progress</div>
            <div className="text-sm font-bold text-emerald-700">
              {totalUploaded} / {MANDATORY_DOCUMENTS.length} Uploaded
            </div>
          </div>
        </div>
      </div>

      {/* Separate LoA and EoA Selection Buttons */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Select Application Category <span className="text-rose-500">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select whether your institution is requesting an initial Letter of Approval (LoA) or an annual Extension of Approval (EoA).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isNewMode && (
              <Link
                href="/institution/submit/approval?mode=new"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-blue-700 shadow-sm transition"
              >
                + Start Fresh Application
              </Link>
            )}
            {isSubmitted && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                🔒 Application Type Locked ({applicationType})
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. LoA — Letter of Approval Button */}
          <button
            id="btn-select-loa"
            type="button"
            disabled={isSubmitted}
            onClick={() => {
              if (!isSubmitted) {
                setApplicationType("LOA");
                setMessage(null);
              }
            }}
            className={`p-5 rounded-xl border-2 text-left transition flex items-start gap-4 ${
              applicationType === "LOA"
                ? "border-blue-700 bg-blue-600 text-white shadow-lg ring-4 ring-blue-200"
                : "border-slate-300 bg-white text-slate-800 hover:border-blue-400 hover:bg-slate-50"
            } ${isSubmitted ? "cursor-not-allowed opacity-90" : "cursor-pointer"}`}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                applicationType === "LOA"
                  ? "border-white bg-white text-blue-700"
                  : "border-slate-400 bg-white"
              }`}
            >
              {applicationType === "LOA" ? (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-700" />
              ) : null}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-extrabold text-base ${applicationType === "LOA" ? "text-white" : "text-slate-900"}`}>
                  LoA — Letter of Approval
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  applicationType === "LOA" ? "bg-blue-800 text-white border border-blue-400" : "bg-blue-100 text-blue-800"
                }`}>
                  New Institution
                </span>
              </div>
              <p className={`text-xs mt-1.5 leading-relaxed ${applicationType === "LOA" ? "text-blue-100" : "text-slate-500"}`}>
                For new technical institutions seeking initial AICTE approval and introduction of new programmes/courses.
              </p>
              {applicationType === "LOA" && (
                <div className="mt-2 text-[11px] font-semibold text-blue-100 flex items-center gap-1">
                  <span>✓</span> LoA Request Selected
                </div>
              )}
            </div>
          </button>

          {/* 2. EoA — Extension of Approval Button */}
          <button
            id="btn-select-eoa"
            type="button"
            disabled={isSubmitted}
            onClick={() => {
              if (!isSubmitted) {
                setApplicationType("EOA");
                setMessage(null);
              }
            }}
            className={`p-5 rounded-xl border-2 text-left transition flex items-start gap-4 ${
              applicationType === "EOA"
                ? "border-blue-700 bg-blue-600 text-white shadow-lg ring-4 ring-blue-200"
                : "border-slate-300 bg-white text-slate-800 hover:border-blue-400 hover:bg-slate-50"
            } ${isSubmitted ? "cursor-not-allowed opacity-90" : "cursor-pointer"}`}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                applicationType === "EOA"
                  ? "border-white bg-white text-blue-700"
                  : "border-slate-400 bg-white"
              }`}
            >
              {applicationType === "EOA" ? (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-700" />
              ) : null}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-extrabold text-base ${applicationType === "EOA" ? "text-white" : "text-slate-900"}`}>
                  EoA — Extension of Approval
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  applicationType === "EOA" ? "bg-blue-800 text-white border border-blue-400" : "bg-emerald-100 text-emerald-800"
                }`}>
                  Existing Institution
                </span>
              </div>
              <p className={`text-xs mt-1.5 leading-relaxed ${applicationType === "EOA" ? "text-blue-100" : "text-slate-500"}`}>
                For existing approved technical institutions applying for annual extension of approval and continuation of approved intake.
              </p>
              {applicationType === "EOA" && (
                <div className="mt-2 text-[11px] font-semibold text-blue-100 flex items-center gap-1">
                  <span>✓</span> EoA Request Selected
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Dynamic Contextual Form Guidance based on selection */}
        {applicationType === "LOA" && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
            <span className="text-base leading-none">📄</span>
            <div>
              <strong className="font-bold">LoA Application Submission Form Active:</strong> You are submitting a request for initial <strong>Letter of Approval (LoA)</strong>. Upload all 12 mandatory statutory documents below.
            </div>
          </div>
        )}

        {applicationType === "EOA" && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
            <span className="text-base leading-none">📄</span>
            <div>
              <strong className="font-bold">EoA Application Submission Form Active:</strong> You are submitting a request for annual <strong>Extension of Approval (EoA)</strong>. Upload all 12 mandatory statutory documents below.
            </div>
          </div>
        )}

        {!applicationType && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
            <span className="text-base leading-none">⚠️</span>
            <div>
              <strong className="font-bold">Select Application Category:</strong> Please choose either <strong>LoA — Letter of Approval</strong> or <strong>EoA — Extension of Approval</strong> above to proceed with your application submission.
            </div>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm font-semibold ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 12 Document Categories Cards */}
      <div className="space-y-3">
        {MANDATORY_DOCUMENTS.map((doc) => {
          const state = docState[doc.id] || {};

          return (
            <div
              key={doc.id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                    {doc.code}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{doc.name}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">{doc.description}</p>

                {state.fileName && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-600 font-medium">Uploaded File:</span>
                    <a
                      href={state.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline font-mono bg-blue-50 px-2 py-0.5 rounded text-[11px]"
                    >
                      📎 {state.originalName || state.fileName}
                    </a>
                  </div>
                )}

                {state.error && (
                  <div className="text-xs text-rose-600 mt-1 font-medium">{state.error}</div>
                )}
              </div>

              {/* Upload Action */}
              <div className="flex items-center gap-3 shrink-0">
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold px-3.5 py-2 rounded-lg transition inline-flex items-center gap-1.5">
                  <span>{state.uploading ? "Uploading..." : state.fileName ? "Re-upload" : "Upload"}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    disabled={state.uploading || isSubmitted}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileUpload(doc.id, e.target.files[0]);
                      }
                    }}
                  />
                </label>

                {state.fileName ? (
                  <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                    <span>✓</span> Saved
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">Pending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submission Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4">
        <div className="text-xs text-slate-500">
          Save as draft to preserve progress anytime. Final submission locks documents for authorized FD employee verification.
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving || isSubmitted}
            className="flex-1 sm:flex-none bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || isSubmitted}
            className="flex-1 sm:flex-none bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition shadow-md disabled:opacity-50"
          >
            {saving ? "Submitting..." : applicationType ? `Submit ${applicationType} Request` : "Submit Approval Application"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalSeekingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Approval Application...</div>}>
      <ApprovalSeekingContent />
    </Suspense>
  );
}
