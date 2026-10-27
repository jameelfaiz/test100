"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface RuleItem {
  id: number;
  ruleNumber: string;
  clause: string;
  pageRef: string;
  summary: string;
  tag: string;
}

interface SlideItem {
  id: number;
  slideNumber: number;
  title: string;
  subtitle: string;
  icon: string;
  rules: RuleItem[];
}

const SLIDES: SlideItem[] = [
  {
    id: 1,
    slideNumber: 1,
    title: "SLIDE 1 — SECURITY DEPOSIT RULES",
    subtitle: "Regulatory mandates governing Joint FDR, security deposits, release procedures, and penalties",
    icon: "🏦",
    rules: [
      {
        id: 1,
        ruleNumber: "RULE 1",
        clause: "Clause 1.12: Security Deposit",
        pageRef: "Printed Page: 10",
        tag: "Deposit Requirement",
        summary: "Institutions must maintain the prescribed security deposit according to applicable AICTE requirements. This rule explains which institutions must submit the deposit, applicable amounts, and conditions for holding or returning it."
      },
      {
        id: 2,
        ruleNumber: "RULE 2",
        clause: "Clause 6.46: Release of Security Deposit",
        pageRef: "Printed Page: 61",
        tag: "Release Authorization",
        summary: "Security deposit release requires the prescribed application, supporting documents, necessary clearances, verification, and final authorization."
      },
      {
        id: 3,
        ruleNumber: "RULE 3",
        clause: "Affidavit 6: Release of Security Deposit",
        pageRef: "Printed Page: 192; PDF Page: Approximately 208",
        tag: "Legal Declaration",
        summary: "Institutions requesting security deposit release must provide prescribed declarations, institution information, trust/society/company details, FDR information, and supporting evidence."
      },
      {
        id: 4,
        ruleNumber: "RULE 4",
        clause: "Clause 7.7: Security Deposit Penalties",
        pageRef: "Printed Page: Approximately 73",
        tag: "Statutory Penalties",
        summary: "Premature FDR encashment, failure to maintain the required security deposit, or violation of AICTE deposit conditions may lead to regulatory penalties or action."
      }
    ]
  },
  {
    id: 2,
    slideNumber: 2,
    title: "SLIDE 2 — COMPLAINTS AND APPROVALS",
    subtitle: "Procedures for grievance investigations, EoA extensions, new institution grants, and changes",
    icon: "⚖️",
    rules: [
      {
        id: 5,
        ruleNumber: "RULE 5",
        clause: "Clause 7.10: Complaint Cases",
        pageRef: "Page: Verify against official handbook",
        tag: "Grievance Investigation",
        summary: "Complaints against technical institutions may be examined and investigated. Proven violations may lead to regulatory action affecting institutional approval."
      },
      {
        id: 6,
        ruleNumber: "RULE 6",
        clause: "Chapter II: Extension of Approval (EoA)",
        pageRef: "Page: Chapter II",
        tag: "Annual Extension",
        summary: "Existing technical institutions applying for annual Extension of Approval must meet applicable eligibility, submission, document, deficiency, and compliance requirements."
      },
      {
        id: 7,
        ruleNumber: "RULE 7",
        clause: "Chapter I: Grant of Approval for New Institutions",
        pageRef: "Page: Chapter I",
        tag: "New Grant (LoA)",
        summary: "New technical institutions must satisfy prescribed application, infrastructure, document verification, and security deposit requirements before issuance of a Letter of Approval (LoA)."
      },
      {
        id: 8,
        ruleNumber: "RULE 8",
        clause: "Chapter VI: Other Approval and Compliance Procedures",
        pageRef: "Page: Chapter VI",
        tag: "Regulatory Compliance",
        summary: "Institutional changes and other approval processes require the applicable supporting documents, regulatory verification, and compliance with AICTE procedures."
      }
    ]
  },
  {
    id: 3,
    slideNumber: 3,
    title: "SLIDE 3 — VIOLATIONS AND DOCUMENTS",
    subtitle: "Enforcement actions, mandatory statutory affidavits, and documentation annexures",
    icon: "📜",
    rules: [
      {
        id: 9,
        ruleNumber: "RULE 9",
        clause: "Chapter VII: Actions for Violations of AICTE Norms",
        pageRef: "Page: Chapter VII",
        tag: "Norms Enforcement",
        summary: "AICTE may take regulatory action against institutions for incorrect information, violations of approval conditions, non-compliance, or proven complaints."
      },
      {
        id: 10,
        ruleNumber: "RULE 10",
        clause: "Prescribed Affidavits and Application Formats",
        pageRef: "Page: Handbook Annexures",
        tag: "Annexures & Formats",
        summary: "Institutions must submit the prescribed declarations, undertakings, application formats, and supporting documents relevant to their approval or deposit-release process."
      },
      {
        id: 11,
        ruleNumber: "RULE 11",
        clause: "Clause 6.1: Documents for New Technical Institutions",
        pageRef: "Printed Page: Chapter VI, starting page 53",
        tag: "Annexure 1 Norms",
        summary: "Applications for establishing new technical institutions must include the documents prescribed under Annexure 1."
      },
      {
        id: 12,
        ruleNumber: "RULE 12",
        clause: "Clause 6.2: Documents for Extension of Approval",
        pageRef: "Page: Chapter VI",
        tag: "Annexure 2 Norms",
        summary: "Existing institutions seeking Extension of Approval must submit documents according to Annexure 2."
      }
    ]
  },
  {
    id: 4,
    slideNumber: 4,
    title: "SLIDE 4 — ACADEMIC AND COMPLIANCE RULES",
    subtitle: "Calendar adherence, degree/diploma entry criteria, fee refunds, and release requisites",
    icon: "🎓",
    rules: [
      {
        id: 13,
        ruleNumber: "RULE 13",
        clause: "Clause 6.3: Academic Calendar Compliance",
        pageRef: "Page: Chapter VI",
        tag: "Calendar Adherence",
        summary: "AICTE-approved technical institutions must follow the academic calendar notified by the Council."
      },
      {
        id: 14,
        ruleNumber: "RULE 14",
        clause: "Clause 6.4: Programme Duration and Entry Qualifications",
        pageRef: "Page: Chapter VI",
        tag: "Academic Standards",
        summary: "Technical programmes must follow prescribed durations and entry qualification requirements for diploma, undergraduate, and postgraduate levels."
      },
      {
        id: 15,
        ruleNumber: "RULE 15",
        clause: "Clause 6.45: Fee Refund Policy",
        pageRef: "Printed Page: Approximately 61",
        tag: "Fee Refund Policy",
        summary: "Institutions must comply with applicable student fee refund, original certificate return, and admission withdrawal requirements. This is separate from institutional FDR release."
      },
      {
        id: 16,
        ruleNumber: "RULE 16",
        clause: "Clause 6.46(a): Required Documents for FDR Release",
        pageRef: "Printed Page: 61",
        tag: "FDR Submission Checklist",
        summary: "Security deposit release applications require the prescribed request letter, Affidavit 6, applicable FDR/payment evidence, and latest LoA/EoA."
      }
    ]
  },
  {
    id: 5,
    slideNumber: 5,
    title: "SLIDE 5 — CLEARANCE AND FINAL RELEASE",
    subtitle: "PGRC/Vigilance clearances, Approval Bureau NOC, RTGS sanction, and financial integrity",
    icon: "🛡️",
    rules: [
      {
        id: 17,
        ruleNumber: "RULE 17",
        clause: "Clause 6.46(b): Mandatory Clearance Before FDR Release",
        pageRef: "Printed Page: 61",
        tag: "Clearance Requirement",
        summary: "Security deposit release requires clearance from the Public Grievance Redressal Cell, Vigilance Cell, and other applicable AICTE cells or bureaus."
      },
      {
        id: 18,
        ruleNumber: "RULE 18",
        clause: "Clause 6.46(c): NOC for FDR/RPGF Release",
        pageRef: "Printed Page: 61",
        tag: "Bureau NOC",
        summary: "After the necessary clearances are obtained, the AICTE Approval Bureau issues the No Objection Certificate for FDR or RPGF release."
      },
      {
        id: 19,
        ruleNumber: "RULE 19",
        clause: "Clause 6.46(d): RTGS Sanction Order",
        pageRef: "Printed Page: 61",
        tag: "RTGS Sanction",
        summary: "For security deposits handled through RTGS, the Council issues the applicable sanction order."
      },
      {
        id: 20,
        ruleNumber: "RULE 20",
        clause: "Clause 6.46(e): Financial Embezzlement and Deposit Release",
        pageRef: "Printed Page: 61",
        tag: "Integrity Safeguard",
        summary: "Where financial embezzlement issues involve government bodies or banks, security deposit release remains restricted until the required NOC is received from the concerned body."
      }
    ]
  }
];

export default function HandbookPage() {
  const [activeSlide, setActiveSlide] = useState(0);

  // Automatic slideshow rotation every 2 seconds (2000 milliseconds)
  // Continuous looping: Slide 1 -> 2 -> 3 -> 4 -> 5 -> 1
  // Starts automatically when the page loads, does not pause on hover, does not require user clicks
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((previous) => (previous + 1) % 5);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  const currentSlide = SLIDES[activeSlide];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
            <span>🏛️</span> AICTE Approval Process Handbook (APH)
          </div>
          <h1 className="text-2xl font-extrabold text-blue-950 mt-2">
            AICTE Regulatory Handbook — 20 Core Rules
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative regulatory summaries across 5 automated categories: Security Deposits, Approvals, Violations, Academics, and Clearances.
          </p>
        </div>

        {/* Live Automatic Rotation Status Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Automatic Rotation
            </div>
            <div className="text-sm font-bold text-blue-900 flex items-center gap-1.5 justify-end">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Slide {activeSlide + 1} of 5</span>
            </div>
          </div>
        </div>
      </div>

      {/* Non-interactive Slide Indicators */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm pointer-events-none select-none">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
          <span>Automated Slide Progress (2s per slide)</span>
          <span className="text-blue-700 font-mono">
            {currentSlide.slideNumber} / {SLIDES.length}: {currentSlide.title}
          </span>
        </div>

        {/* 5 Non-interactive progress indicators */}
        <div className="grid grid-cols-5 gap-2">
          {SLIDES.map((slide, idx) => {
            const isActive = idx === activeSlide;
            return (
              <div
                key={slide.id}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  isActive
                    ? "bg-blue-600 ring-2 ring-blue-300 shadow-sm"
                    : "bg-slate-200"
                }`}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-5 gap-2 mt-1.5 text-[10px] text-slate-400 font-medium text-center">
          <span>1. Security Deposits</span>
          <span>2. Approvals</span>
          <span>3. Violations</span>
          <span>4. Academics</span>
          <span>5. Clearances</span>
        </div>
      </div>

      {/* Horizontal Carousel Container */}
      <div className="relative overflow-hidden rounded-2xl shadow-sm border border-slate-200 bg-slate-50">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{
            transform: `translateX(-${activeSlide * 100}%)`,
            willChange: "transform",
          }}
        >
          {SLIDES.map((slide) => (
            <div
              key={slide.id}
              className="w-full shrink-0 p-6 md:p-8 space-y-6 box-border"
              style={{ minWidth: "100%" }}
            >
              {/* Slide Heading Banner */}
              <div className="bg-blue-950 text-white p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2 bg-blue-900 rounded-lg">{slide.icon}</span>
                  <div>
                    <div className="text-xs text-blue-300 font-bold uppercase tracking-wider">
                      Section {slide.slideNumber} of 5
                    </div>
                    <h2 className="text-lg md:text-xl font-bold tracking-tight">
                      {slide.title}
                    </h2>
                    <p className="text-xs text-blue-200 mt-0.5">{slide.subtitle}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block bg-blue-900 text-blue-200 text-xs font-semibold px-3 py-1 rounded-full border border-blue-800">
                    4 Rules Displayed
                  </span>
                </div>
              </div>

              {/* Responsive 2x2 Rule-Card Grid (4 Rules per slide) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slide.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-300 transition"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="bg-blue-950 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded font-mono">
                          {rule.ruleNumber}
                        </span>
                        <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {rule.tag}
                        </span>
                      </div>

                      {/* Rule Title / Clause */}
                      <h3 className="text-sm md:text-base font-bold text-slate-900 leading-snug">
                        {rule.clause}
                      </h3>

                      {/* Exact Page Reference */}
                      <div className="text-[11px] font-mono text-slate-500 mt-1 mb-2 bg-slate-50 px-2 py-1 rounded border border-slate-150 inline-block">
                        📍 {rule.pageRef}
                      </div>

                      {/* Summary Text */}
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed mt-1">
                        {rule.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Action Navigation Footer */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Quick Access Portal Workflows
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/institution/submit/approval"
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📝</span>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-blue-900">Approval Seeking</div>
                <div className="text-[10px] text-slate-500">Submit LoA or EoA Application</div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-blue-600 text-sm">→</span>
          </Link>

          <Link
            href="/institution/submit/payment"
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🏦</span>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-blue-900">FDR Submission</div>
                <div className="text-[10px] text-slate-500">Submit Security Deposit Records</div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-blue-600 text-sm">→</span>
          </Link>

          <Link
            href="/institution/receive/loa-eoa"
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📜</span>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-blue-900">Receive LoA / EoA</div>
                <div className="text-[10px] text-slate-500">View Official Approval Letters</div>
              </div>
            </div>
            <span className="text-slate-400 group-hover:text-blue-600 text-sm">→</span>
          </Link>
        </div>
      </div>

      {/* Reduced-motion CSS support */}
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .transition-transform {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
