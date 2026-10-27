"use client";

import React, { useState, useEffect } from "react";

const apiBase = "/api";

interface DocUpload {
  fileName: string;
  originalName: string;
  fileUrl: string;
}

interface ReleaseRequest {
  _id: string;
  releaseRequestId: string;
  fdrReference: string;
  reason: string;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  PENDING_FD_REVIEW: "bg-yellow-100 text-yellow-800",
};

const RELEASE_DOCS = [
  { key: "releaseLetter", label: "Release Letter", icon: "📜", description: "Official release letter from the institution/management requesting FDR release." },
  { key: "eoa", label: "Extension of Approval (EoA)", icon: "📋", description: "Latest valid EoA letter issued by AICTE for the institution." },
  { key: "affidavit", label: "Affidavit", icon: "⚖️", description: "Duly notarized affidavit as per AICTE prescribed format." },
  { key: "fdrCopy", label: "FDR Copy", icon: "🏦", description: "Attested photocopy of the Fixed Deposit Receipt to be released." },
];

export default function ReleaseApplicationPage() {
  const [csrfToken, setCsrfToken] = useState("");
  const [releases, setReleases] = useState<ReleaseRequest[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [fdrReference, setFdrReference] = useState("");
  const [reason, setReason] = useState("");
  const [docs, setDocs] = useState<Record<string, DocUpload | null>>({
    releaseLetter: null,
    eoa: null,
    affidavit: null,
    fdrCopy: null,
  });
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const allDocsUploaded = RELEASE_DOCS.every(d => docs[d.key] !== null);

  useEffect(() => {
    async function load() {
      try {
        const cr = await fetch(`${apiBase}/auth/csrf-token`, { credentials: "include" });
        if (cr.ok) setCsrfToken((await cr.json()).csrfToken);
        const rr = await fetch(`${apiBase}/institution/release-requests`, { credentials: "include" });
        if (rr.ok) setReleases(await rr.json());
      } catch (e) { console.error(e); }
    }
    load();
  }, []);

  async function handleDocUpload(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(u => ({ ...u, [key]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${apiBase}/institution/upload`, {
        method: "POST", credentials: "include",
        headers: { "X-XSRF-TOKEN": csrfToken },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        setDocs(d => ({ ...d, [key]: { fileName: data.fileName, originalName: data.originalName, fileUrl: data.fileUrl } }));
      } else {
        setMsg({ text: `Failed to upload ${key}.`, type: "error" });
      }
    } catch {
      setMsg({ text: "Upload error.", type: "error" });
    } finally {
      setUploading(u => ({ ...u, [key]: false }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fdrReference || !reason) {
      setMsg({ text: "FDR Reference and Reason are required.", type: "error" }); return;
    }
    if (!allDocsUploaded) {
      setMsg({ text: "All four documents must be uploaded before submission.", type: "error" }); return;
    }
    setSaving(true); setMsg(null);
    try {
      const payload = {
        fdrReference,
        reason,
        documents: {
          releaseLetter: docs.releaseLetter?.fileName,
          eoa: docs.eoa?.fileName,
          affidavit: docs.affidavit?.fileName,
          fdrCopy: docs.fdrCopy?.fileName,
        },
      };
      const res = await fetch(`${apiBase}/institution/release-request`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": csrfToken },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Release request submitted successfully.", type: "success" });
        setReleases(prev => [data.releaseRequest, ...prev]);
        setFdrReference(""); setReason("");
        setDocs({ releaseLetter: null, eoa: null, affidavit: null, fdrCopy: null });
      } else {
        setMsg({ text: data.message || "Submission failed.", type: "error" });
      }
    } catch {
      setMsg({ text: "Network error.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Release Application</h1>
        <p className="text-slate-500 text-sm mt-1">Submit a formal request to release the Fixed Deposit Receipt (FDR) held with AICTE.</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {msg.type === "success" ? "✅" : "❌"} {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-950 text-white px-6 py-4">
            <h2 className="text-base font-semibold">Release Request Details</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">FDR Reference Number *</label>
              <input
                type="text" required
                value={fdrReference}
                onChange={(e) => setFdrReference(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter FDR Reference Number"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Release *</label>
              <textarea
                required rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Provide detailed reason for FDR release request..."
              />
            </div>
          </div>
        </div>

        {/* Document Upload Cards */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-950 text-white px-6 py-4">
            <h2 className="text-base font-semibold">Mandatory Documents</h2>
            <p className="text-blue-200 text-xs mt-0.5">All four documents are required before submission.</p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {RELEASE_DOCS.map(docDef => {
              const uploaded = docs[docDef.key];
              const isUploading = uploading[docDef.key];
              return (
                <div key={docDef.key} className={`rounded-xl border-2 p-5 transition-all ${uploaded ? "border-green-400 bg-green-50" : "border-slate-200 bg-slate-50 hover:border-blue-300"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">{docDef.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800">{docDef.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{docDef.description}</div>
                    </div>
                    {uploaded && <span className="text-green-600 text-lg">✓</span>}
                  </div>

                  {uploaded ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 truncate max-w-[160px]">{uploaded.originalName}</span>
                        <span className="text-xs text-green-600 font-medium">Uploaded</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocs(d => ({ ...d, [docDef.key]: null }))}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Replace
                      </button>
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center gap-2 w-full text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition border ${isUploading ? "bg-slate-200 text-slate-500 border-slate-300" : "bg-blue-950 text-white border-blue-950 hover:bg-blue-900"}`}>
                      {isUploading ? "Uploading..." : "Upload Document"}
                      <input
                        type="file" className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleDocUpload(docDef.key, e)}
                        disabled={isUploading}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-6 pb-4">
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${allDocsUploaded ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {allDocsUploaded ? "✅ All required documents uploaded. You can now submit." : `⚠️ ${RELEASE_DOCS.filter(d => !docs[d.key]).length} document(s) still required.`}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !allDocsUploaded}
            className="bg-blue-950 hover:bg-blue-900 text-white font-semibold px-8 py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Submitting..." : "Submit Release Request"}
          </button>
        </div>
      </form>

      {/* Previous Release Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Previous Release Requests</h2>
        </div>
        {releases.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">No release requests submitted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Request ID", "FDR Reference", "Reason", "Status", "Submitted On"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {releases.map(r => (
                  <tr key={r._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.releaseRequestId}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.fdrReference}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[r.status] || "bg-slate-100 text-slate-700"}`}>
                        {r.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
