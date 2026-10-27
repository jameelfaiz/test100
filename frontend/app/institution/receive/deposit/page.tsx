"use client";

import React, { useState, useEffect } from "react";
import { Landmark, Calendar, DollarSign, CheckCircle2, ShieldCheck, ArrowRight, Building, FileText, Info } from "lucide-react";
import Link from "next/link";

const apiBase = "/api";

interface DepositInstructionItem {
  applicationId: string;
  programme?: string;
  letterReferenceNumber?: string;
  depositAmount: number;
  bankAccountNumber: string;
  bankName?: string;
  branchName?: string;
  ifscCode?: string;
  paymentInstructions?: string;
  depositDeadline?: string;
  sentAt?: string;
  sentBy?: string;
  version?: number;
  status?: string;
}

interface DepositItem {
  fdrNumber: string;
  amount: number;
  status: string;
  date: string;
}

export default function DepositDetailsPage() {
  const [instructions, setInstructions] = useState<DepositInstructionItem[]>([]);
  const [clearances, setClearances] = useState<DepositItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch Deposit Instructions issued by FD employee
    const p1 = fetch(`${apiBase}/institution/receive/deposit-details`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { depositDetails: [] }))
      .then((d) => setInstructions(d.depositDetails || []))
      .catch(console.error);

    // 2. Fetch Clearances (Section 2: Verified FDR Deposits)
    const p2 = fetch(`${apiBase}/institution/receive/documents`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { depositClearances: [] }))
      .then((d: { depositClearances?: DepositItem[] }) => {
        setClearances(d.depositClearances || []);
      })
      .catch(console.error);

    Promise.all([p1, p2]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Deposit Instructions & Records</h1>
        <p className="text-slate-500 text-sm mt-1">
          Official bank deposit instructions from the AICTE Finance Division (FD) and FDR clearance records.
        </p>
      </div>

      {/* SECTION 1: OFFICIAL DEPOSIT INSTRUCTIONS ISSUED BY FD EMPLOYEE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-950 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">AICTE Deposit Instructions ({instructions.length})</h2>
            <p className="text-blue-200 text-xs mt-0.5">
              Specific bank account and required deposit amount details issued by the FD employee
            </p>
          </div>
          <span className="text-xs bg-emerald-700 text-emerald-100 px-3 py-1 rounded-full font-medium flex items-center gap-1">
            <ShieldCheck size={13} /> Official AICTE Issuance
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">Loading deposit instructions...</div>
        ) : instructions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-slate-700 font-medium text-base">No deposit instructions issued yet.</div>
            <div className="text-slate-400 text-sm mt-1">
              Deposit instructions will appear here after your Letter of Approval (LoA/EoA) is issued by the Finance Division.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {instructions.map((inst, idx) => (
              <div key={idx} className="p-6 bg-slate-50/50 hover:bg-slate-50 transition">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏦</span>
                      <h3 className="font-bold text-slate-900 text-base">
                        Deposit Instructions for {inst.programme || "Approval Application"}
                      </h3>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900">
                        Version {inst.version || 1} — Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                      {/* Deposit Amount */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <DollarSign size={13} /> Required Deposit Amount
                        </div>
                        <div className="text-xl font-black text-blue-900">
                          ₹{Number(inst.depositAmount).toLocaleString("en-IN")}
                        </div>
                      </div>

                      {/* AICTE Account Number */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <Landmark size={13} /> Account Number
                        </div>
                        <div className="text-lg font-mono font-bold text-slate-900 break-all">
                          {inst.bankAccountNumber}
                        </div>
                      </div>

                      {/* Deposit Deadline */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <Calendar size={13} /> Last Date for Deposit
                        </div>
                        <div className="text-base font-bold text-amber-800">
                          {inst.depositDeadline
                            ? new Date(inst.depositDeadline).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </div>
                      </div>

                      {/* Bank Name & Branch */}
                      {(inst.bankName || inst.branchName) && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                            <Building size={13} /> Bank & Branch
                          </div>
                          <div className="text-sm font-bold text-slate-900">
                            {inst.bankName || "AICTE Bank"}
                          </div>
                          {inst.branchName && (
                            <div className="text-xs text-slate-500">{inst.branchName}</div>
                          )}
                        </div>
                      )}

                      {/* IFSC Code */}
                      {inst.ifscCode && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                            <FileText size={13} /> IFSC Code
                          </div>
                          <div className="text-sm font-mono font-bold text-slate-900">
                            {inst.ifscCode}
                          </div>
                        </div>
                      )}

                      {/* Reference Number */}
                      {inst.letterReferenceNumber && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                            <Info size={13} /> Reference Number
                          </div>
                          <div className="text-xs font-mono font-bold text-blue-900 break-all">
                            {inst.letterReferenceNumber}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment Instructions if provided */}
                    {inst.paymentInstructions && (
                      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-950">
                        <strong className="font-semibold block mb-1">Payment Instructions:</strong>
                        <span>{inst.paymentInstructions}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
                      <span>Application Reference: <strong className="font-mono text-slate-800">{inst.applicationId}</strong></span>
                      <span>Issued Date: <strong>{inst.sentAt ? new Date(inst.sentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</strong></span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-start lg:items-end justify-center pt-2">
                    <Link
                      href="/institution/submit/payment"
                      className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-sm"
                    >
                      Submit FDR Details <ArrowRight size={14} />
                    </Link>
                    <span className="text-[11px] text-slate-400 mt-1">Submit receipt once deposit is placed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: VERIFIED FDR DEPOSITS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Verified FDR Deposits ({clearances.length})</h2>
            <p className="text-emerald-200 text-xs mt-0.5">FDR submissions verified by the Finance Division (FD) employee</p>
          </div>
          <span className="text-xs bg-emerald-900 text-emerald-200 px-3 py-1 rounded-full font-medium">Clearance Verified</span>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-center text-slate-400 text-sm">Loading...</div>
        ) : clearances.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-3xl mb-2">🏦</div>
            <div className="text-slate-500 text-sm">No verified FDR deposits yet. Submit FDR details under Submit → Payment / FDR.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["FDR Number", "Amount (₹)", "Status", "Verified On"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clearances.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{c.fdrNumber}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium">₹{Number(c.amount).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                        <CheckCircle2 size={12} /> {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(c.date).toLocaleDateString("en-IN")}</td>
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
