import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./msalConfig";
import { useApi } from "./hooks/useApi";
import AutoSplitModal from "./components/AutoSplitModal";
import AdminHome from "./admin/AdminHome";
import { isAdminAccount } from "./utils/isAdmin";

const pad2 = (n) => String(n).padStart(2, "0");
const yyyymmdd = (d = new Date()) => d.toISOString().slice(0, 10);
const hhmm = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

export default function App() {
  const { instance, accounts } = useMsal();
  const api = useApi();

  const activeAccount = useMemo(() => {
    const current = instance.getActiveAccount();
    if (current) return current;
    if (accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
      return accounts[0];
    }
    return null;
  }, [accounts, instance]);

  const isAdmin = !!activeAccount && isAdminAccount(activeAccount);
  const accountName =
    activeAccount?.name ||
    activeAccount?.idTokenClaims?.name ||
    activeAccount?.username ||
    null;

  // ---- UI state ----
  const [date, setDate] = useState(yyyymmdd());
  const [tracking, setTracking] = useState(false);
  const [currentTask, setCurrentTask] = useState("");
  const [startTime, setStartTime] = useState(null);

  const [logEntries, setLogEntries] = useState([]);
  const [status, setStatus] = useState("open");
  const [workingContext, setWorkingContext] = useState({
    isDayOff: false,
    workStart: "09:00",
    workEnd: "17:30",
    workingMinutesSuggested: 480,
    timeZone: null,
  });
  const [tasks, setTasks] = useState([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const minutesLogged = useMemo(
    () => logEntries.reduce((sum, e) => sum + (e.minutes || 0), 0),
    [logEntries]
  );

  const signIn = async () => {
    await instance.loginRedirect(loginRequest);
  };
  const signOut = async () => {
    await instance.logoutRedirect();
  };

  // Load tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const data = await api.listTasks();
        const active = data
          .filter((x) => !!x.Active)
          .sort((a, b) => (a.Order || 0) - (b.Order || 0));
        setTasks(active.map((t) => t.Title));
      } catch (e) {
        console.error("Failed to load tasks", e);
      }
    };
    if (activeAccount) loadTasks();
  }, [activeAccount]);

  // Fetch daily log
  useEffect(() => {
    const fetchDaily = async () => {
      if (!activeAccount) return;
      try {
        const data = await api.getDailyLog(date);
        setLogEntries(data.logEntries || []);
        setStatus(data.status || "open");
        setWorkingContext({
          isDayOff: data?.workingContext?.isDayOff ?? false,
          workStart: data?.workingContext?.workStart ?? "09:00",
          workEnd: data?.workingContext?.workEnd ?? "17:30",
          workingMinutesSuggested:
            data?.workingContext?.workingMinutesSuggested ?? 480,
          timeZone: data?.workingContext?.timeZone ?? null,
        });
      } catch (e) {
        console.error("Failed to load daily log", e);
        alert("Could not load today's log.");
      }
    };
    fetchDaily();
  }, [activeAccount, date]);

  // Tray integration (optional handlers; safe if not present)
  useEffect(() => {
    if (!window.electronAPI) return;
    const startHandler = () => {
      if (currentTask && !tracking) {
        setStartTime(new Date());
        setTracking(true);
      }
    };
    const stopHandler = () => {
      if (tracking) handleStopTracking();
    };
    window.electronAPI.onStartFromTray(startHandler);
    window.electronAPI.onStopFromTray(stopHandler);
  }, [tracking, currentTask, startTime]);

  const handleStartTracking = () => {
    if (!currentTask) return;
    setStartTime(new Date());
    setTracking(true);
  };

  const handleStopTracking = async () => {
    if (!startTime) return;
    const end = new Date();
    const minutes = Math.max(1, Math.round((end - startTime) / 60000));
    const entry = {
      task: currentTask,
      minutes,
      start: hhmm(startTime),
      end: hhmm(end),
      source: "manual",
    };
    try {
      await api.addEntry({ date, entry });
      setLogEntries((prev) => [...prev, entry]);
    } catch (e) {
      console.error("Failed to save entry", e);
      alert("Could not save entry.");
    } finally {
      setTracking(false);
      setStartTime(null);
    }
  };

  const applyAutoSplit = async (selectedTasks, minutesToDistribute) => {
    try {
      await api.autoSplit({
        date,
        tasks: selectedTasks,
        workingMinutes: minutesToDistribute,
      });
      const data = await api.getDailyLog(date);
      setLogEntries(data.logEntries || []);
      setStatus(data.status || "open");
      setSplitOpen(false);
    } catch (e) {
      console.error("Auto-split failed", e);
      alert("Auto-split failed.");
    }
  };

  const exportTodayToExcel = () => {
    const rows = logEntries.map((e) => ({
      Date: date,
      Name: accountName,
      Task: e.task,
      "Start Time": e.start || "auto",
      "End Time": e.end || "auto",
      Minutes: e.minutes,
      Source: e.source || "manual",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "WorkLog");
    XLSX.writeFile(wb, `work_log_${date}.xlsx`);
  };

  const outsideWorkHours = useMemo(() => {
    if (!workingContext.workStart || !workingContext.workEnd) return false;
    const now = new Date();
    const [sH, sM] = workingContext.workStart.split(":").map(Number);
    const [eH, eM] = workingContext.workEnd.split(":").map(Number);
    const startMinutes = sH * 60 + sM;
    const endMinutes = eH * 60 + eM;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes < startMinutes || nowMinutes > endMinutes;
  }, [workingContext]);

  const input = {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    marginTop: 6,
  };
  const btnBase = {
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    marginTop: 12,
  };
  const btnPrimary = { ...btnBase, background: "#2563eb", color: "#fff" };
  const btnSecondary = { ...btnBase, background: "#374151", color: "#fff" };
  const btnSuccess = { ...btnBase, background: "#16a34a", color: "#fff", width: "100%" };
  const btnDanger = { ...btnBase, background: "#dc2626", color: "#fff", width: "100%" };

  const bannerInfo = {
    background: "#e0f2fe",
    border: "1px solid #bae6fd",
    color: "#0c4a6e",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  };
  const bannerWarn = {
    background: "#fef3c7",
    border: "1px solid #fde68a",
    color: "#78350f",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  };

  const table = { width: "100%", borderCollapse: "collapse", marginTop: 8 };
  const th = {
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    padding: "8px 6px",
  };
  const td = { borderBottom: "1px solid #f3f4f6", padding: "8px 6px" };

  return (
    <div style={{ maxWidth: 680, margin: "32px auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>ECNP Time Tracker</h2>
        {activeAccount ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin && (
              <button onClick={() => setShowAdmin((v) => !v)} style={btnSecondary}>
                {showAdmin ? "Back to Tracker" : "Admin"}
              </button>
            )}
            <div style={{ color: "#2c3e50" }}>
              Signed in as <strong>{accountName}</strong>
            </div>
            <button onClick={signOut} style={btnSecondary}>Sign out</button>
          </div>
        ) : (
          <button onClick={signIn} style={btnPrimary}>Sign in with Microsoft</button>
        )}
      </header>

      {!showAdmin && (
        <>
          <div style={{ marginTop: 8, color: "#6b7280" }}>
            Date: <strong>{date}</strong>
          </div>

          {workingContext.isDayOff && (
            <div style={bannerWarn}>
              Outlook indicates today is a <strong>day off</strong>. Manual tracking is disabled.
              You can still use <em>Auto-split</em> to allocate time if required.
            </div>
          )}
          {outsideWorkHours && !workingContext.isDayOff && (
            <div style={bannerInfo}>
              You're currently outside defined working hours ({workingContext.workStart}–{workingContext.workEnd}).
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label>Task</label>
            <select
              style={input}
              value={currentTask}
              onChange={(e) => setCurrentTask(e.target.value)}
              disabled={tracking || workingContext.isDayOff}
            >
              <option value="">-- Select task --</option>
              {tasks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <button
              style={tracking ? btnDanger : btnSuccess}
              disabled={!activeAccount || !currentTask || workingContext.isDayOff}
              onClick={tracking ? handleStopTracking : handleStartTracking}
            >
              {tracking ? "Stop" : "Start"}
            </button>

            {tracking && (
              <p style={{ marginTop: 8, color: "#555" }}>Tracking in progress…</p>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <h3 style={{ margin: 0 }}>Auto-split time</h3>
              <button onClick={() => setSplitOpen(true)} style={btnPrimary} disabled={!activeAccount}>
                Divide day evenly
              </button>
            </div>
            <p style={{ color: "#6b7280", marginTop: 6 }}>
              Evenly distribute today’s remaining working minutes across selected tasks.
            </p>
          </div>

          <section style={{ marginTop: 16 }}>
            <h3>Today’s entries</h3>
            {logEntries.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No entries yet.</p>
            ) : (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Task</th>
                    <th style={th}>Start</th>
                    <th style={th}>End</th>
                    <th style={th}>Minutes</th>
                    <th style={th}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.map((e, idx) => (
                    <tr key={idx}>
                      <td style={td}>{e.task}</td>
                      <td style={td}>{e.start || "auto"}</td>
                      <td style={td}>{e.end || "auto"}</td>
                      <td style={td}>{e.minutes}</td>
                      <td style={td}>{e.source || "manual"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={td} colSpan={3}>
                      <strong>Total</strong>
                    </td>
                    <td style={td}>
                      <strong>{minutesLogged}</strong>
                    </td>
                    <td style={td}></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {logEntries.length > 0 && (
              <button onClick={exportTodayToExcel} style={btnSecondary}>
                Export today to Excel
              </button>
            )}
          </section>

          <AutoSplitModal
            isOpen={splitOpen}
            onClose={() => setSplitOpen(false)}
            allTasks={tasks}
            defaultWorkingMinutes={
              workingContext.workingMinutesSuggested ?? 480
            }
            minutesAlreadyLogged={minutesLogged}
            isDayOff={workingContext.isDayOff}
            onApply={applyAutoSplit}
          />
        </>
      )}

      {showAdmin && <AdminHome />}
    </div>
  );
}
