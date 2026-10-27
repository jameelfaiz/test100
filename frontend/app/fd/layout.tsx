"use client";

import React from "react";
import AicteAssistant from "../components/AicteAssistant";

export default function FdLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AicteAssistant portalRole="AICTE_FD_EMPLOYEE" />
    </>
  );
}
