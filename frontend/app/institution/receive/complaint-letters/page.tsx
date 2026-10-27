"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Eye,
  Download,
  X,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  XCircle,
  FileSearch,
} from "lucide-react";

interface DocumentDeficiency {
  id: string;
  applicationId: string;
  applicationRef: string;
  applicationType: string;
  documentId: string;
  documentName: string;
  documentPath: string;
  fileUrl: string;
  verificationStatus: "NOT VERIFIED";
  remarks: string;
  decisionDate: string;
  history?: Array<{
    decision: string;
    status: string;
    remarks: string;
    date: string;
    documentPath?: string;
    documentName?: string;
  }>;
}

function ComplaintOutcomeLettersContent() {
  const searchParams = useSearchParams();
  const targetAppId = searchParams?.get("appId") || "";
  const targetDocId = searchParams?.get("docId") || "";
  const targetDocName = searchParams?.get("docName") || "";

  const [deficiencies, setDeficiencies] = useState<DocumentDeficiency[]>([]);
  const [loadingDeficiencies, setLoadingDeficiencies] = useState<boolean>(true);
  const [selectedRemark, setSelectedRemark] = useState<DocumentDeficiency | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentDeficiency | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingDeficiencies(true);
    setFeedback(null);
    try {
      const resDeficiencies = await fetch("/api/institution/receive/document-deficiencies", { credentials: "include" });
      if (resDeficiencies.ok) {
        const data = await resDeficiencies.json();
        const list: DocumentDeficiency[] = data.deficiencies || [];
        setDeficiencies(list);

        // Auto-locate and highlight target deficiency if specified in query params
        if (targetAppId || targetDocId || targetDocName) {
          const match = list.find((d) => {
            const matchApp = targetAppId
              ? (d.applicationId === targetAppId ||
                 d.applicationRef === targetAppId ||
                 String(d.applicationRef).toLowerCase() === String(targetAppId).toLowerCase())
              : true;
            const matchDoc = (targetDocId || targetDocName)
              ? (
                  (targetDocId && (d.documentId === targetDocId || d.id === targetDocId)) ||
                  (targetDocName && (
                    String(d.documentName).toLowerCase() === String(targetDocName).toLowerCase() ||
                    String(d.documentName).toLowerCase().includes(String(targetDocName).toLowerCase()) ||
                    String(targetDocName).toLowerCase().includes(String(d.documentName).toLowerCase())
                  )) ||
                  (targetDocId && (
                    String(d.documentName).toLowerCase() === String(targetDocId).toLowerCase() ||
                    String(d.documentName).toLowerCase().includes(String(targetDocId).toLowerCase()) ||
                    String(targetDocId).toLowerCase().includes(String(d.documentName).toLowerCase())
                  )) ||
                  (d.documentPath && targetDocName && String(d.documentPath).toLowerCase().includes(String(targetDocName).toLowerCase()))
                )
              : true;
            return matchApp && matchDoc;
          }) || (targetDocId || targetDocName ? list.find((d) =>
            (targetDocId && (d.documentId === targetDocId || d.id === targetDocId)) ||
            (targetDocName && String(d.documentName).toLowerCase().includes(String(targetDocName).toLowerCase())) ||
            (targetDocId && String(d.documentName).toLowerCase().includes(String(targetDocId).toLowerCase()))
          ) : null) || (targetAppId ? list.find((d) =>
            d.applicationId === targetAppId || d.applicationRef === targetAppId
          ) : null);

          if (match) {
            setHighlightedId(match.id);
            setSelectedRemark(match);
            setTimeout(() => {
              const el = document.getElementById(`def-row-${match.id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }, 250);
          }
        }
      } else {
        setFeedback("Failed to load document verification remarks.");
      }
    } catch (e: any) {
      console.error("Error fetching receive data", e);
      setFeedback("Error connecting to AICTE server.");
    } finally {
      setLoadingDeficiencies(false);
    }
  }, [targetAppId, targetDocId, targetDocName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Receive Section • Document Scrutiny
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            FD Document Deficiency Remarks
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View document verification remarks and deficiencies recorded by the AICTE Finance Division.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
        >
          <RefreshCw size={14} className={loadingDeficiencies ? "animate-spin text-blue-600" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
          {feedback}
        </div>
      )}

      {/* FD Document Deficiency Remarks Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              Document Verification Scrutiny
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review specific document rejection reasons and deficiencies recorded by the AICTE Finance Division.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-5">Application Reference</th>
                  <th className="py-3.5 px-5">Application Type (LoA/EoA)</th>
                  <th className="py-3.5 px-5">Document Name</th>
                  <th className="py-3.5 px-5">Verification Status</th>
                  <th className="py-3.5 px-5">FD Remark / Rejection Reason</th>
                  <th className="py-3.5 px-5">Decision Date</th>
                  <th className="py-3.5 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loadingDeficiencies ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                      Loading document deficiencies from MongoDB...
                    </td>
                  </tr>
                ) : deficiencies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-sm font-medium">
                      <FileSearch size={28} className="mx-auto mb-2 text-slate-300" />
                      No document deficiency remarks available.
                    </td>
                  </tr>
                ) : (
                  deficiencies.map((d) => {
                    const isHighlighted = d.id === highlightedId;
                    return (
                      <tr
                        key={d.id}
                        id={`def-row-${d.id}`}
                        className={`transition ${isHighlighted ? "bg-amber-100/90 ring-2 ring-amber-500 font-medium" : "hover:bg-slate-50/80"}`}
                      >
                        <td className="py-3.5 px-5 font-mono font-bold text-blue-900 whitespace-nowrap">
                          {d.applicationRef}
                          {isHighlighted && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                              Selected
                            </span>
                          )}
                        </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-700">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          d.applicationType === "LoA"
                            ? "bg-purple-50 text-purple-800 border border-purple-200"
                            : d.applicationType === "EoA"
                            ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                            : "bg-slate-100 text-slate-800 border border-slate-300"
                        }`}>
                          {d.applicationType}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-800">
                        {d.documentName}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                          <XCircle size={12} /> {d.verificationStatus || "NOT VERIFIED"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-700 max-w-xs">
                        <div className="line-clamp-2" title={d.remarks}>
                          {d.remarks}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                        {new Date(d.decisionDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedRemark(d)}
                            className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold px-2.5 py-1.5 rounded border border-amber-300 transition text-xs shadow-sm"
                            title="View complete FD deficiency remarks"
                          >
                            <AlertCircle size={13} /> View Remark
                          </button>
                          <button
                            onClick={() => setPreviewDoc(d)}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-blue-50 text-blue-700 font-semibold px-2.5 py-1.5 rounded border border-slate-300 hover:border-blue-300 transition text-xs"
                            title="Preview submitted document"
                          >
                            <Eye size={13} /> Preview Submitted Document
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: View Remark Modal */}
      {selectedRemark && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-rose-50/70">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-rose-600 flex-shrink-0" />
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-rose-700 font-extrabold block">
                    FD Document Verification Deficiency
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedRemark.documentName}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedRemark(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">Application Reference:</span>
                  <span className="font-mono font-bold text-blue-900">{selectedRemark.applicationRef}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Application Type:</span>
                  <span className="font-semibold text-slate-800">{selectedRemark.applicationType}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Verification Status:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-rose-700 mt-0.5">
                    <XCircle size={13} /> NOT VERIFIED / REJECTED
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Decision Date:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedRemark.decisionDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  Official FD Employee Rejection Remark:
                </label>
                <div className="p-4 bg-rose-50/50 border-l-4 border-rose-500 border rounded-r-lg">
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-medium">
                    {selectedRemark.remarks}
                  </p>
                </div>
              </div>

              {selectedRemark.history && selectedRemark.history.length > 0 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                    Previous Decision History:
                  </label>
                  <div className="space-y-2">
                    {selectedRemark.history.map((h, i) => (
                      <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                        <div className="flex justify-between items-center mb-1 text-slate-500 font-medium">
                          <span>Decision: <strong className="text-slate-700">{h.status || h.decision}</strong></span>
                          <span>{new Date(h.date).toLocaleDateString("en-IN")}</span>
                        </div>
                        {h.remarks && <p className="text-slate-700 italic">"{h.remarks}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                <strong>Next Step:</strong> Please rectify the deficiency highlighted above and re-upload the revised document via <strong>Submit Section → AICTE Approval Seeking</strong>.
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <button
                onClick={() => {
                  const toPreview = selectedRemark;
                  setSelectedRemark(null);
                  setPreviewDoc(toPreview);
                }}
                className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs px-3.5 py-2 rounded-lg border border-blue-200 transition"
              >
                <Eye size={14} /> Preview Document
              </button>
              <button
                onClick={() => setSelectedRemark(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Preview Submitted Document Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-extrabold block">
                  Submitted Document Preview
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {previewDoc.documentName}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ref: <span className="font-mono font-semibold text-blue-900">{previewDoc.applicationRef}</span> • Status: <span className="text-rose-700 font-bold">NOT VERIFIED</span>
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-100/70 flex items-center justify-center min-h-[350px]">
              {previewDoc.documentPath && previewDoc.documentPath.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewDoc.fileUrl || `/api/institution/files/${previewDoc.documentPath}`}
                  className="w-full h-[520px] rounded-lg border border-slate-300 bg-white"
                  title={previewDoc.documentName}
                />
              ) : previewDoc.documentPath && /\.(png|jpe?g)$/i.test(previewDoc.documentPath) ? (
                <div className="text-center p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <img
                    src={previewDoc.fileUrl || `/api/institution/files/${previewDoc.documentPath}`}
                    alt={previewDoc.documentName}
                    className="max-h-[500px] max-w-full object-contain mx-auto rounded"
                  />
                </div>
              ) : (
                <div className="text-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm max-w-md">
                  <FileText size={48} className="text-blue-600 mx-auto mb-3" />
                  <p className="font-bold text-slate-800 text-sm">{previewDoc.documentName}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    File: {previewDoc.documentPath || "Official Uploaded File"}
                  </p>
                  <a
                    href={previewDoc.fileUrl || `/api/institution/files/${previewDoc.documentPath}`}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#152843] text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition"
                  >
                    <Download size={14} /> Download Document
                  </a>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
              {previewDoc.documentPath && (
                <a
                  href={previewDoc.fileUrl || `/api/institution/files/${previewDoc.documentPath}`}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#152843] text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition"
                >
                  <Download size={14} /> Download File
                </a>
              )}
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
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

export default function ComplaintOutcomeLettersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Loading document scrutiny...</div>}>
      <ComplaintOutcomeLettersContent />
    </Suspense>
  );
}
