"use client";

import React, { useState, useEffect } from "react";

const apiBase = "/api";

interface Payment {
  _id: string;
  paymentId: string;
  referenceNumber: string;
  amount: number;
  status: string;
  createdAt: string;
  bankName?: string;
  branchName?: string;
  maturityDate?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VERIFIED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
};

export default function PaymentFDRPage() {
  const [csrfToken, setCsrfToken] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ fileName: string; originalName: string; fileUrl: string } | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [form, setForm] = useState({
    fdrNumber: "",
    amount: "",
    maturityDate: "",
    bankName: "",
    branchName: "",
    ifscCode: "",
    bankEmployeeName: "",
    bankEmployeeId: "",
    bankEmployeeDesignation: "",
    bankEmployeeContact: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const cr = await fetch(`${apiBase}/auth/csrf-token`, { credentials: "include" });
        if (cr.ok) setCsrfToken((await cr.json()).csrfToken);
        const pr = await fetch(`${apiBase}/institution/payments`, { credentials: "include" });
        if (pr.ok) setPayments(await pr.json());
      } catch (e) { console.error(e); }
    }
    load();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
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
        setUploadedFile({ fileName: data.fileName, originalName: data.originalName, fileUrl: data.fileUrl });
        setMsg({ text: "FDR document uploaded successfully.", type: "success" });
      } else {
        setMsg({ text: "Upload failed. Please try again.", type: "error" });
      }
    } catch {
      setMsg({ text: "Upload error.", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fdrNumber || !form.amount || !form.bankName) {
      setMsg({ text: "FDR Number, Amount, and Bank Name are required.", type: "error" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/institution/payment`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": csrfToken },
        body: JSON.stringify({
          ...form,
          documentPath: uploadedFile?.fileName,
          originalDocumentName: uploadedFile?.originalName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "FDR details submitted successfully for FD verification.", type: "success" });
        setPayments((prev) => [data.payment, ...prev]);
        setForm({ fdrNumber: "", amount: "", maturityDate: "", bankName: "", branchName: "", ifscCode: "", bankEmployeeName: "", bankEmployeeId: "", bankEmployeeDesignation: "", bankEmployeeContact: "" });
        setUploadedFile(null);
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
        <h1 className="text-2xl font-bold text-slate-900">Payment Details / FDR Submission</h1>
        <p className="text-slate-500 text-sm mt-1">Submit Fixed Deposit Receipt (FDR) and bank details for AICTE financial verification.</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {msg.type === "success" ? "✅" : "❌"} {msg.text}
        </div>
      )}

      {/* Submission Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-950 text-white px-6 py-4">
          <h2 className="text-base font-semibold">New FDR / Payment Submission</h2>
          <p className="text-blue-200 text-xs mt-0.5">All fields marked * are required</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* FDR Details */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 border-b pb-2">FDR Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">FDR Number *</label>
                <input
                  type="text" required
                  value={form.fdrNumber}
                  onChange={(e) => setForm(f => ({ ...f, fdrNumber: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="FDR-XXXX-XXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">FDR Amount (₹) *</label>
                <input
                  type="number" required min="0"
                  value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 1000000"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Maturity Date</label>
                <input
                  type="date"
                  value={form.maturityDate}
                  onChange={(e) => setForm(f => ({ ...f, maturityDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 border-b pb-2">Bank Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Name *</label>
                <input
                  type="text" required
                  value={form.bankName}
                  onChange={(e) => setForm(f => ({ ...f, bankName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. State Bank of India"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={form.branchName}
                  onChange={(e) => setForm(f => ({ ...f, branchName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Anna Nagar Branch"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={form.ifscCode}
                  onChange={(e) => setForm(f => ({ ...f, ifscCode: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="SBIN0001234"
                />
              </div>
            </div>
          </div>

          {/* Bank Employee Details */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 border-b pb-2">Bank Employee Details (Authorised Signatory)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee Name</label>
                <input
                  type="text"
                  value={form.bankEmployeeName}
                  onChange={(e) => setForm(f => ({ ...f, bankEmployeeName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Branch Manager Name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={form.bankEmployeeId}
                  onChange={(e) => setForm(f => ({ ...f, bankEmployeeId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="EMP-XXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
                <input
                  type="text"
                  value={form.bankEmployeeDesignation}
                  onChange={(e) => setForm(f => ({ ...f, bankEmployeeDesignation: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Branch Manager"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Number</label>
                <input
                  type="tel"
                  value={form.bankEmployeeContact}
                  onChange={(e) => setForm(f => ({ ...f, bankEmployeeContact: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="10-digit mobile number"
                />
              </div>
            </div>
          </div>

          {/* FDR Document Upload */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 border-b pb-2">FDR Document Upload</h3>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50">
              {uploadedFile ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-xl">📄</span>
                    <div className="text-left">
                      <div className="text-sm font-medium text-slate-800">{uploadedFile.originalName}</div>
                      <div className="text-xs text-green-600">Uploaded successfully</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">📁</div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Upload FDR Document (PDF/Image)</p>
                  <p className="text-xs text-slate-500 mb-4">Accepted: PDF, JPG, PNG (max 10 MB)</p>
                  <label className="inline-flex items-center gap-2 bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-900 transition">
                    {uploading ? "Uploading..." : "Choose File"}
                    <input
                      type="file" className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-950 hover:bg-blue-900 text-white font-semibold px-8 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit for FD Verification"}
            </button>
          </div>
        </form>
      </div>

      {/* Existing Submissions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Previous Submissions</h2>
        </div>
        {payments.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">No FDR submissions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Payment ID", "FDR Number", "Amount (₹)", "Bank Name", "Maturity Date", "Status", "Submitted"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.paymentId}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.referenceNumber}</td>
                    <td className="px-4 py-3 text-slate-800">₹{p.amount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{p.bankName || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.maturityDate ? new Date(p.maturityDate).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-700"}`}>
                        {p.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString("en-IN")}</td>
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
