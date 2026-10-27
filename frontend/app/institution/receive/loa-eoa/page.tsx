"use client";

import React, { useState, useEffect } from "react";
import { Eye, Download, Printer, X, CheckCircle2, ShieldCheck } from "lucide-react";

const apiBase = "/api";

interface LoaEoaItem {
  applicationId: string;
  title: string;
  programme?: string;
  intake?: number;
  type: string;
  letterType?: string;
  referenceNo: string;
  approvedDate: string;
  letterText?: string;
  fileUrl?: string;
  institutionName?: string;
}

export default function LoaEoaPage() {
  const [items, setItems] = useState<LoaEoaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLetter, setPreviewLetter] = useState<LoaEoaItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/institution/receive/loa-eoa`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { letters: [] }))
      .then((d) => {
        if (d.letters && d.letters.length > 0) {
          setItems(d.letters);
        } else {
          // Fallback to receive/documents
          return fetch(`${apiBase}/institution/receive/documents`, { credentials: "include" })
            .then((r2) => (r2.ok ? r2.json() : { loaEoaList: [] }))
            .then((d2) => setItems(d2.loaEoaList || []));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const downloadLetterAsPdf = async (item: LoaEoaItem) => {
    setDownloadError(null);
    setDownloadingId(item.applicationId);
    try {
      const res = await fetch(`${apiBase}/institution/receive/loa-eoa/${encodeURIComponent(item.applicationId)}/pdf`, {
        credentials: "include",
      });

      if (!res.ok) {
        let errMsg = `Failed to download letter (${res.status} ${res.statusText})`;
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
        } catch {
          // Response body was not JSON
        }
        setDownloadError(errMsg);
        alert(errMsg);
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/pdf") && !contentType.includes("octet-stream")) {
        const errMsg = "Received invalid document format from server. Please log in again if session expired.";
        setDownloadError(errMsg);
        alert(errMsg);
        return;
      }

      let filename = `EoA_Letter_${item.applicationId}.pdf`;
      const disposition = res.headers.get("content-disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      } else if (item.letterType === "LOA" || item.type.includes("LoA")) {
        filename = `LoA_Letter_${item.applicationId}.pdf`;
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
      console.error("Letter download error:", err);
      const msg = err.message || "Failed to download letter. Please check network connection.";
      setDownloadError(msg);
      alert(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Letter of Approval / Extension of Approval</h1>
        <p className="text-slate-500 text-sm mt-1">Official AICTE approval letters issued to your institution.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <p className="text-sm text-blue-800">
          <strong>LoA (Letter of Approval):</strong> Issued when your institution&apos;s application is approved for new courses or intake. &nbsp;
          <strong>EoA (Extension of Approval):</strong> Issued for periodic continuation of approval following document verification.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-950 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Issued Approval Letters ({items.length})</h2>
          <span className="text-xs bg-blue-800 text-blue-200 px-2.5 py-1 rounded-full font-medium">Verified by AICTE FD</span>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">Loading approval letters...</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-4xl mb-3">📄</div>
            <div className="text-slate-600 font-medium">No approval letters issued yet.</div>
            <div className="text-slate-400 text-sm mt-1">
              LoA / EoA letters appear here once all required documents are verified and approved by the Finance Division.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <div key={i} className="px-6 py-5 hover:bg-slate-50 transition">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🏛️</span>
                      <span className="font-semibold text-slate-900">{item.type}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={12} /> Approved
                      </span>
                    </div>
                    <div className="text-sm text-slate-700 font-medium mb-1">
                      {item.programme || item.title}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
                      <span>Institution: <strong className="text-slate-800">{item.institutionName || "Institution"}</strong></span>
                      <span>Application Reference: <strong className="font-mono text-slate-800">{item.applicationId}</strong></span>
                      <span>Letter Reference: <strong className="font-mono text-blue-900">{item.referenceNo}</strong></span>
                      <span>Issuance Date: <strong>{new Date(item.approvedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong></span>
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
                      disabled={downloadingId === item.applicationId}
                      title={item.letterType === "EOA" || item.type.includes("EoA") ? "Download EoA Letter" : "Download LoA Letter"}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                    >
                      <Download size={14} />
                      {downloadingId === item.applicationId
                        ? "Downloading..."
                        : item.letterType === "EOA" || item.type.includes("EoA")
                        ? "Download EoA Letter"
                        : "Download LoA Letter"}
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
            <div className="bg-blue-950 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" size={20} />
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
                {previewLetter.letterText || "Approval letter content is being generated."}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => downloadLetterAsPdf(previewLetter)}
                disabled={downloadingId === previewLetter.applicationId}
                title={previewLetter.letterType === "EOA" || previewLetter.type.includes("EoA") ? "Download EoA Letter" : "Download LoA Letter"}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                <Download size={14} />
                {downloadingId === previewLetter.applicationId
                  ? "Downloading..."
                  : previewLetter.letterType === "EOA" || previewLetter.type.includes("EoA")
                  ? "Download EoA Letter"
                  : "Download LoA Letter"}
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
