"use client";

import React from "react";
import AicteAssistant from "../components/AicteAssistant";

export default function VigilanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AicteAssistant portalRole="VIGILANCE_EMPLOYEE" />
    </>
  );
}
