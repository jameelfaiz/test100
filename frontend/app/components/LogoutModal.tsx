"use client";

import React from "react";
import { LogOut } from "lucide-react";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function LogoutModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: LogoutModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 text-slate-800">
        {/* Icon Badge */}
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <LogOut size={22} />
        </div>

        {/* Title & Body */}
        <h3
          id="logout-title"
          className="text-lg font-bold text-slate-900 text-center mb-1"
        >
          Confirm Logout
        </h3>
        <p className="text-sm text-slate-600 text-center mb-6">
          Are you sure you want to log out?
        </p>

        {/* Action Buttons: Cancel and Logout */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="cancel-logout-btn"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-logout-btn"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
          >
            <LogOut size={16} />
            <span>{loading ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
