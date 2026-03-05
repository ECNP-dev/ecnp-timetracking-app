import React, { useState } from "react";
import { useApi } from "../hooks/useApi";

export default function AdminReport() {
  const api = useApi();
  const [month, setMonth] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!month) {
      alert("Choose a month");
      return;
    }
    setBusy(true);
    try {
      const blob = await api.downloadMonthlyReport(month);
      const fileName = `ECNP_WorkLog_${month}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to generate report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3>Monthly Report</h3>
      <label>Month</label>
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      <button onClick={generate} disabled={!month || busy} style={{ marginLeft: 8 }}>
        {busy ? "Generating…" : "Download Excel"}
      </button>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        A copy is also saved to SharePoint: <code>Shared Documents/General/ICT/Timetracking</code>.
      </p>
    </div>
  );
}
