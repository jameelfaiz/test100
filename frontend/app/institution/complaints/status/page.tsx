"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const apiBase = "/api";

interface Complaint {
  _id: string;
  title: string;
  description: string;
  status: string;
  category?: string;
  applicationId?: string;
  institutionId: string;
  pgrcRemarks?: string;
  vigilanceRemarks?: string;
  supervisorRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

const WORKFLOW_STEPS = [
  { key: "filed", label: "Complaint Filed", icon: "📝", statuses: ["PENDING"] },
  { key: "pgrc", label: "PGRC Review", icon: "👁️", statuses: ["UNDER_REVIEW"] },
  { key: "escalated", label: "Escalated", icon: "⬆️", statuses: ["ESCALATED"] },
  { key: "investigation", label: "Vigilance Investigation", icon: "🔍", statuses: ["UNDER_INVESTIGATION"] },
  { key: "resolved", label: "Resolution", icon: "⚖️", statuses: ["PROVEN", "UNSUBSTANTIATED", "INCONCLUSIVE", "RESOLVED", "CLOSED"] },
];

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

function getStepStatus(status: string, stepIdx: number) {
  const statusOrder: Record<string, number> = {
    PENDING: 0, UNDER_REVIEW: 1, ESCALATED: 2, UNDER_INVESTIGATION: 3,
    PROVEN: 4, UNSUBSTANTIATED: 4, INCONCLUSIVE: 4, RESOLVED: 4, CLOSED: 4,
  };
  const current = statusOrder[status] ?? 0;
  if (current > stepIdx) return "done";
  if (current === stepIdx) return "active";
  return "pending";
}

function ComplaintStatusContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        if (id) {
          const r = await fetch(`${apiBase}/institution/complaint/${id}`, { credentials: "include" });
          if (r.ok) setComplaint(await r.json());
        }
        const lr = await fetch(`${apiBase}/institution/complaints`, { credentials: "include" });
        if (lr.ok) {
          const data = await lr.json();
          setComplaints(Array.isArray(data) ? data : []);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  if (loading) return <div className="text-slate-400 text-sm p-8">Loading complaint status...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Complaint Status Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Track your complaint through PGRC → Vigilance → Supervisor workflow.</p>
        </div>
        <Link href="/institution/complaints/raise" className="bg-blue-950 hover:bg-blue-900 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition">
          + Raise New
        </Link>
      </div>

      {complaint ? (
        <>
          {/* Complaint Detail */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-blue-950 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{complaint.title}</h2>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[complaint.status] || "bg-slate-100 text-slate-700"}`}>
                  {complaint.status?.replace(/_/g, " ")}
                </span>
              </div>
              {complaint.category && <div className="text-blue-200 text-xs mt-1">Category: {complaint.category}</div>}
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">{complaint.description}</p>

              {/* Progress Tracker */}
              <div className="mt-6">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-4">Resolution Progress</h3>
                <div className="relative">
                  {WORKFLOW_STEPS.map((step, i) => {
                    const stepStatus = getStepStatus(complaint.status, i);
                    return (
                      <div key={step.key} className="flex gap-4 mb-4 last:mb-0">
                        <div className="flex flex-col items-center">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base border-2 transition-all ${
                            stepStatus === "done" ? "border-green-500 bg-green-100" :
                            stepStatus === "active" ? "border-blue-600 bg-blue-100 ring-4 ring-blue-100" :
                            "border-slate-200 bg-slate-50"
                          }`}>
                            {stepStatus === "done" ? "✓" : step.icon}
                          </div>
                          {i < WORKFLOW_STEPS.length - 1 && (
                            <div className={`w-0.5 h-8 mt-1 ${stepStatus === "done" ? "bg-green-400" : "bg-slate-200"}`} />
                          )}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <div className={`text-sm font-semibold ${stepStatus === "active" ? "text-blue-800" : stepStatus === "done" ? "text-green-800" : "text-slate-400"}`}>
                            {step.label}
                          </div>
                          {stepStatus === "active" && (
                            <div className="text-xs text-blue-600 mt-0.5">Currently at this stage</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Remarks sections */}
              {(complaint.pgrcRemarks || complaint.vigilanceRemarks || complaint.supervisorRemarks) && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Official Remarks</h3>
                  {complaint.pgrcRemarks && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-800 mb-1">PGRC Review Remarks</div>
                      <div className="text-sm text-blue-900">{complaint.pgrcRemarks}</div>
                    </div>
                  )}
                  {complaint.vigilanceRemarks && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-purple-800 mb-1">Vigilance Investigation Remarks</div>
                      <div className="text-sm text-purple-900">{complaint.vigilanceRemarks}</div>
                    </div>
                  )}
                  {complaint.supervisorRemarks && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-green-800 mb-1">Supervisor Resolution Remarks</div>
                      <div className="text-sm text-green-900">{complaint.supervisorRemarks}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-slate-400 border-t pt-3">
                Filed: {new Date(complaint.createdAt).toLocaleString("en-IN")} &nbsp;|&nbsp;
                Last updated: {new Date(complaint.updatedAt).toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          <Link href="/institution/complaints/list" className="inline-block text-blue-700 hover:underline text-sm font-medium">
            ← Back to all complaints
          </Link>
        </>
      ) : (
        /* List of all complaints if none selected */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-slate-50">
            <h2 className="text-base font-semibold text-slate-900">Select a complaint to track</h2>
          </div>
          {complaints.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-slate-600">No complaints filed yet.</div>
              <Link href="/institution/complaints/raise" className="mt-3 inline-block text-blue-700 underline text-sm">Raise a complaint</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {complaints.map(c => (
                <Link key={c._id} href={`/institution/complaints/status?id=${c._id}`} className="block px-6 py-4 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{c.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[c.status] || "bg-slate-100 text-slate-700"}`}>
                        {c.status?.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-400 text-xs">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ComplaintStatusPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 p-8">Loading...</div>}>
      <ComplaintStatusContent />
    </Suspense>
  );
}
