"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const apiBase = "/api";

export default function InstitutionDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(`${apiBase}/institution/dashboard-overview`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to load dashboard data");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading Institution Dashboard...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg">
        {error}
      </div>
    );
  }

  const inst = data?.institution || {};
  const stats = data?.stats || {};


  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-blue-950 font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {inst.registrationStatus || "APPROVED"}
            </span>
            <span className="text-blue-200 text-xs font-mono">
              College ID: {inst.collegeId}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1 tracking-tight">
            {inst.name || "Institution Portal"}
          </h1>
          <p className="text-blue-200 text-xs mt-1">
            {inst.address}, {inst.district}, {inst.state} | Authorized: {inst.authorizedContactPerson || inst.principalName}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/institution/submit/approval?mode=new"
            id="btn-new-approval-request"
            className="bg-amber-500 hover:bg-amber-600 text-blue-950 font-bold text-xs px-4 py-2.5 rounded-lg shadow transition"
          >
            + New Approval Request
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Applications
          </div>
          <div className="text-2xl font-extrabold text-blue-950 mt-1">
            {stats.totalApplications || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
            <span className="text-amber-600 font-bold">{stats.pendingApplications || 0} Pending</span>
            <span>•</span>
            <span className="text-emerald-600 font-bold">{stats.approvedApplications || 0} Approved</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            FDR & Payments
          </div>
          <div className="text-2xl font-extrabold text-blue-950 mt-1">
            {stats.totalPayments || 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            {stats.verifiedPayments || 0} Verified by FD
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Release Requests
          </div>
          <div className="text-2xl font-extrabold text-blue-950 mt-1">
            {stats.totalReleases || 0}
          </div>
          <div className="text-[11px] text-blue-600 font-bold mt-1">
            {stats.approvedReleases || 0} Approved
          </div>
        </div>
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/institution/submit/approval"
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition flex items-start gap-3.5 group"
        >
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-xl group-hover:bg-blue-600 group-hover:text-white transition">
            📄
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition">
              Approval Seeking Module
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Upload the 10+ mandatory AICTE compliance documents and submit for FD review.
            </div>
          </div>
        </Link>

        <Link
          href="/institution/submit/payment"
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition flex items-start gap-3.5 group"
        >
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xl group-hover:bg-emerald-600 group-hover:text-white transition">
            💳
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">
              Payment / FDR Submission
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Submit Fixed Deposit Receipt and bank branch officer details for FD verification.
            </div>
          </div>
        </Link>

        <Link
          href="/institution/submit/release"
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition flex items-start gap-3.5 group"
        >
          <div className="p-3 bg-amber-50 text-amber-700 rounded-lg text-xl group-hover:bg-amber-600 group-hover:text-white transition">
            🔓
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition">
              Release Application
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Submit release request with 4 mandatory documents: Release Letter, EoA, Affidavit, FDR copy.
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
