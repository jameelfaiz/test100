"use client";

import React from "react";
import AicteAssistant from "../components/AicteAssistant";

export default function PgrcLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AicteAssistant portalRole="PGRC_EMPLOYEE" />
    </>
  );
}
