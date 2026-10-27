"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const apiBase = "/api";

interface Complaint {
  _id: string;
  title: string;
  description: string;
  status: string;
  category?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  ESCALATED: "bg-orange-100 text-orange-800",
  UNDER_INVESTIGATION: "bg-purple-100 text-purple-800",
  PROVEN: "bg-green-100 text-green-800",
  UNSUBSTANTIATED: "bg-gray-100 text-gray-700",
  INCONCLUSIVE: "bg-slate-100 text-slate-700",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-slate-100 text-slate-600",
};

export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  useEffect(() => {
    fetch(`${apiBase}/institution/complaints`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setComplaints(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = complaints.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c._id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Complaints</h1>
          <p className="text-slate-500 text-sm mt-1">All complaints filed by your institution.</p>
        </div>
        <Link
          href="/institution/complaints/raise"
          className="bg-blue-950 hover:bg-blue-900 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition"
        >
          + Raise Complaint
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by title or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="ALL">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">Loading complaints...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-slate-600 font-medium">{complaints.length === 0 ? "No complaints filed yet." : "No complaints match your search."}</div>
            {complaints.length === 0 && (
              <Link href="/institution/complaints/raise" className="mt-4 inline-block text-blue-700 hover:text-blue-900 text-sm font-medium underline">
                Raise your first complaint →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["#", "Title", "Category", "Status", "Filed On", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c, i) => (
                  <tr key={c._id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.title}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{c.description}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{c.category || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[c.status] || "bg-slate-100 text-slate-700"}`}>
                        {c.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/institution/complaints/status?id=${c._id}`}
                        className="text-blue-700 hover:text-blue-900 text-xs font-medium hover:underline"
                      >
                        Track Status →
                      </Link>
                    </td>
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
