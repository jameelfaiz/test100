"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const apiBase = "/api";

const CATEGORIES = [
  "Infrastructure", "Faculty", "Admissions", "Financial Irregularity",
  "Examination", "Affiliation", "Fee Structure", "Harassment",
  "Transparency", "Other"
];

export default function RaiseComplaintPage() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    applicationId: "",
  });

  useEffect(() => {
    fetch(`${apiBase}/auth/csrf-token`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCsrfToken(d.csrfToken))
      .catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description) {
      setMsg({ text: "Title and Description are required.", type: "error" }); return;
    }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${apiBase}/institution/complaint`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": csrfToken },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Complaint registered successfully. It will be reviewed by PGRC.", type: "success" });
        setForm({ title: "", description: "", category: "", applicationId: "" });
        setTimeout(() => router.push("/institution/complaints/list"), 2000);
      } else {
        setMsg({ text: data.message || "Failed to submit complaint.", type: "error" });
      }
    } catch {
      setMsg({ text: "Network error.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Raise a Complaint</h1>
        <p className="text-slate-500 text-sm mt-1">
          Complaints are routed through PGRC → Escalation → Vigilance Investigation → Supervisor Resolution.
        </p>
      </div>

      {/* Workflow Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-blue-900 mb-3">Complaint Resolution Workflow</h3>
        <div className="flex flex-wrap gap-2 items-center text-xs text-blue-800">
          {["Raise Complaint", "PGRC Review", "Escalation (if needed)", "Vigilance Investigation", "Supervisor Resolution"].map((step, i, arr) => (
            <React.Fragment key={step}>
              <span className="bg-blue-100 text-blue-900 font-semibold px-3 py-1 rounded-full">{step}</span>
              {i < arr.length - 1 && <span className="text-blue-400">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {msg.type === "success" ? "✅" : "❌"} {msg.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-950 text-white px-6 py-4">
          <h2 className="text-base font-semibold">Complaint Details</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Complaint Title *</label>
            <input
              type="text" required
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief summary of the complaint"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">— Select Category —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Application Reference ID (optional)</label>
              <input
                type="text"
                value={form.applicationId}
                onChange={(e) => setForm(f => ({ ...f, applicationId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="APP-XXXX (if complaint relates to application)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description *</label>
            <textarea
              required rows={6}
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Provide a detailed description of the complaint. Include dates, references, and specific issues..."
            />
            <div className="text-right text-xs text-slate-400 mt-1">{form.description.length} characters</div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            ⚠️ Filing a false complaint is a serious offence. Please ensure all information provided is accurate and truthful.
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/institution/complaints/list")}
              className="px-5 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-950 hover:bg-blue-900 text-white font-semibold px-8 py-2 rounded-lg transition disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit Complaint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
