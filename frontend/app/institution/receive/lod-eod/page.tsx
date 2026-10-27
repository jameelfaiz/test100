"use client";

import React, { useState, useEffect } from "react";
import { Eye, Download, Printer, X, AlertTriangle } from "lucide-react";

const apiBase = "/api";

interface LodItem {
  applicationId: string;
  title: string;
  programme?: string;
  type: string;
  letterType?: string;
  referenceNo: string;
  date: string;
  reason?: string;
  letterText?: string;
  deficiencies?: Array<{ docName: string; remarks: string }>;
  documents?: Array<{ id: string; name: string; remarks: string; status: string }>;
}

export default function LodEodPage() {
  const [items, setItems] = useState<LodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLetter, setPreviewLetter] = useState<LodItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/institution/receive/lod-eod`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { letters: [] }))
      .then((d) => {
        if (d.letters && d.letters.length > 0) {
          setItems(d.letters);
        } else {
          // Fallback to receive/documents
          return fetch(`${apiBase}/institution/receive/documents`, { credentials: "include" })
            .then((r2) => (r2.ok ? r2.json() : { lodEodList: [] }))
            .then((d2) => setItems(d2.lodEodList || []));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const downloadLetterAsPdf = async (item: LodItem) => {
    setDownloadingId(item.applicationId);
    try {
      const res = await fetch(`${apiBase}/institution/receive/lod-eod/${encodeURIComponent(item.applicationId)}/pdf`, {
        credentials: "include",
      });

      if (!res.ok) {
        let errMsg = `Failed to download notice (${res.status} ${res.statusText})`;
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
        } catch {
          // not json
        }
        alert(errMsg);
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/pdf") && !contentType.includes("octet-stream")) {
        alert("Received invalid document format from server. Please log in again if session expired.");
        return;
      }

      let filename = `EoD_Notice_${item.applicationId}.pdf`;
      const disposition = res.headers.get("content-disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      } else if (item.letterType === "LOD" || item.type.includes("LoD")) {
        filename = `LoD_Notice_${item.applicationId}.pdf`;
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (err: any) {
      console.error("Deficiency notice download error:", err);
      alert(err.message || "Failed to download deficiency notice. Please check network connection.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Letter of Deficiency / Extension of Deficiency</h1>
        <p className="text-slate-500 text-sm mt-1">Deficiency notices issued by AICTE Finance Division requiring corrective compliance.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <p className="text-sm text-amber-800">
          <strong>LoD (Letter of Deficiency):</strong> Issued when submitted documents have outstanding deficiencies that must be rectified. &nbsp;
          <strong>EoD (Extension of Deficiency):</strong> Issued when deficiency compliance is overdue.
          Please review the specific document remarks below and take corrective action.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-amber-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Deficiency Notices ({items.length})</h2>
          <span className="text-xs bg-amber-700 text-amber-100 px-2.5 py-1 rounded-full font-medium">Action Required</span>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">Loading deficiency notices...</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-slate-700 font-medium text-base">No deficiency notices issued.</div>
            <div className="text-slate-400 text-sm mt-1">All your applications are in good standing without unverified deficiencies.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <div key={i} className="px-6 py-5 bg-amber-50/40 hover:bg-amber-50 transition">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">⚠️</span>
                      <span className="font-semibold text-slate-900">{item.type}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                        Deficiency Noted
                      </span>
                    </div>
                    <div className="text-sm text-slate-800 font-medium mb-2">
                      {item.programme || item.title}
                    </div>

                    {/* Document Level Remarks */}
                    <div className="bg-white border border-amber-200 rounded-lg p-3 my-3">
                      <div className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-1.5">
                        Specific Deficiencies Identified by FD Employee:
                      </div>
                      {item.deficiencies && item.deficiencies.length > 0 ? (
                        <ul className="space-y-1.5 text-xs text-slate-700">
                          {item.deficiencies.map((def, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="font-bold text-amber-800">• {def.docName}:</span>
                              <span className="text-slate-800">{def.remarks}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-700">
                          {item.reason || "Deficiencies noted during document verification review."}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
                      <span>Application: <strong className="font-mono text-slate-800">{item.applicationId}</strong></span>
                      <span>Reference: <strong className="font-mono text-amber-900">{item.referenceNo}</strong></span>
                      <span>Notice Date: <strong>{new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPreviewLetter(item)}
                      className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 transition"
                    >
                      <Eye size={14} /> Preview Letter
                    </button>
                    <button
                      onClick={() => downloadLetterAsPdf(item)}
                      className="inline-flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                    >
                      <Download size={14} /> Download PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Letter Preview Modal */}
      {previewLetter && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewLetter(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-amber-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-300" size={20} />
                <h3 className="font-semibold text-base">{previewLetter.type}</h3>
              </div>
              <button onClick={() => setPreviewLetter(null)} className="text-slate-300 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 text-center font-medium">
                [PROTOTYPE GENERATED DOCUMENT — FOR DEMONSTRATION PURPOSES ONLY — NOT AN OFFICIAL AICTE ISSUANCE]
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 font-serif text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                {previewLetter.letterText || "Deficiency letter content is being loaded."}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => downloadLetterAsPdf(previewLetter)}
                className="inline-flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                <Printer size={14} /> Download / Print PDF
              </button>
              <button
                onClick={() => setPreviewLetter(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
