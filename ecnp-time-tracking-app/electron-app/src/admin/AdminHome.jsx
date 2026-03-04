import React, { useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { isAdminAccount } from "../utils/isAdmin";
import AdminTasks from "./AdminTasks";
import AdminReport from "./AdminReport";

export default function AdminHome() {
  const { instance, accounts } = useMsal();
  const account = useMemo(
    () => instance.getActiveAccount() || accounts[0],
    [instance, accounts]
  );
  const [tab, setTab] = useState("tasks");

  if (!account || !isAdminAccount(account)) {
    return <div style={{ color: "#b91c1c" }}>Access denied. Admin only.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setTab("tasks")} style={tab === "tasks" ? sel : btn}>
          Tasks
        </button>
        <button onClick={() => setTab("report")} style={tab === "report" ? sel : btn}>
          Monthly Report
        </button>
      </div>
      {tab === "tasks" ? <AdminTasks /> : <AdminReport />}
    </div>
  );
}

const btn = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#fff",
};
const sel = { ...btn, background: "#2563eb", color: "#fff", borderColor: "#2563eb" };
