
// src/App.jsx — MSAL removed; tray mini-mode (Option 2); pause/resume; last-tasks auto-select;
// daily CSV (user), monthly subfolder reports, admin-only month picker,
// launch-in-tray toggle, minimize-to-tray, tray icon color updates.

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ----------------------- Small utility helpers ----------------------- */
function initialsFor(nameOrEmail = "") {
  const raw = (nameOrEmail || "").split("@")[0];
  const parts = raw.split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (raw?.[0] || "U").toUpperCase();
}
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
const GearIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke="#444" strokeWidth="1.8"/>
    <path d="M19.4 15a7.97 7.97 0 0 0 .1-2 8 8 0 0 0-.1-2l2.1-1.6-2-3.4-2.5.7A8.1 8.1 0 0 0 15 5.1L14.3 3h-4.6L9 5.1A8.03 8.03 0 0 0 7 6.7l-2.5-.7-2 3.4 2.1 1.6a7.66 7.66 0 0 0 0 4.1l-2.1 1.6 2 3.4 2.5-.7a8.1 8.1 0 0 0 2 1.6l.7 2.1h4.6l.7-2.1a8.1 8.1 0 0 0 2-1.6l2.5.7 2-3.4-2.1-1.6z" stroke="#444" strokeWidth="1.8"/>
  </svg>
);

/* ----------------------- Main component ----------------------- */
export default function App() {
  /* Auth (name only) */
  const [storedUser, setStoredUser] = useState(null);
  const [username, setUsername] = useState("");
  const [nameErr, setNameErr] = useState("");

  /* Navigation */
  const [page, setPage] = useState("main"); // "main" | "settings"

  /* Tasks */
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  /* Selection & timer */
  const [selected, setSelected] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const startedAtRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  /* Reports (admin picks any year/month) */
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));

  /* Settings: logs folder / override / startup in tray */
  const [logsDir, setLogsDir] = useState("");
  const [overridePath, setOverridePath] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [launchInTray, setLaunchInTray] = useState(false);

  const isTrayMode = window.location.hash === "#/tray";
  const isAdmin = storedUser === "admin";
  const userInitials = useMemo(() => initialsFor(storedUser || username), [storedUser, username]);

  /* Load name */
  useEffect(() => {
    const saved = localStorage.getItem("ecnp-username");
    if (saved) setStoredUser(saved);
  }, []);

  /* Load tasks (IPC via preload) */
  useEffect(() => {
    window.ecnp?.loadTasks?.()
      .then(arr => Array.isArray(arr) ? setTasks(arr) : setTasks(["Focus work", "Meetings", "Support", "Admin"]))
      .catch(() => setTasks(["Focus work", "Meetings", "Support", "Admin"]));
  }, []); // baseline behavior preserved [2](https://ecnp-my.sharepoint.com/personal/a_parisella_ecnp_eu/Documents/Microsoft%20Copilot%20Chat%20Files/index.jsx)

  /* Logs dir & startup toggle */
  useEffect(() => {
    window.ecnp?.getLogsDir?.().then(setLogsDir).catch(()=>{});
    const saved = localStorage.getItem("launch-in-tray");
    if (saved === "true") setLaunchInTray(true);
  }, []);

  /* Start last used tasks automatically (per user) */
  useEffect(() => {
    if (!storedUser) return;
    const key = `last-selected-tasks::${storedUser}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(saved) && saved.length) {
        setSelected(saved.filter(t => tasks.includes(t)));
      }
    } catch {}
  }, [storedUser, tasks]);
  useEffect(() => {
    if (!storedUser) return;
    const key = `last-selected-tasks::${storedUser}`;
    localStorage.setItem(key, JSON.stringify(selected));
  }, [selected, storedUser]);

  /* Elapsed counter while running */
  useEffect(() => {
    let id = null;
    if (isRunning) {
      const started = startedAtRef.current;
      id = setInterval(() => setElapsedMs(Date.now() - started), 1000);
    }
    return () => clearInterval(id);
  }, [isRunning]);

  /* Global toggle (Ctrl+Alt+L): Start → Pause/Resume → Stop */
  useEffect(() => {
    const handler = () => {
      if (isRunning) stopTimer();
      else if (isPaused) resumeTimer();
      else startTimer();
    };
    window.ecnpTimer?.onGlobalToggle?.(handler);
  }, [isRunning, isPaused, selected]);

  /* Name login */
  const handleNameLogin = () => {
    setNameErr("");
    const trimmed = username.trim();
    if (!trimmed) { setNameErr("Please enter a name."); return; }
    if (trimmed.length < 2) { setNameErr("Name must be at least 2 characters."); return; }
    localStorage.setItem("ecnp-username", trimmed);
    setStoredUser(trimmed);
  };

  const handleLogout = () => {
    localStorage.removeItem("ecnp-username");
    setStoredUser(null);
    setUsername("");
    setSelected([]);
  };

  /* Admin tasks */
  const addTask = () => {
    const t = newTask.trim();
    if (!t) return;
    if (tasks.includes(t)) { setNewTask(""); return; }
    const next = [...tasks, t].sort((a, b) => a.localeCompare(b));
    setTasks(next);
    setNewTask("");
  };
  const removeTask = (t) => setTasks(tasks.filter(x => x !== t));
  const saveTaskList = async () => {
    try { await window.ecnp?.saveTasks?.(storedUser, tasks); alert("Tasks saved."); }
    catch(e){ alert("Saving tasks failed: " + (e?.message||e)); }
  };

  /* Selection chips */
  const toggleSelected = (t) => {
    setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  /* Timer core with pause/resume */
  async function appendElapsed(ms) {
    if (!window.ecnp?.appendDaily) { alert("Cannot write logs: preload API missing."); return; }
    const minutes = Math.max(1, Math.round(ms/60000));
    const entries = selected.map(task => ({ task, minutes }));
    await window.ecnp.appendDaily({ dateISO: todayISO(), user: storedUser, entries });
  }

  const startTimer = () => {
    if (selected.length === 0) { alert("Select at least one task."); return; }
    if (isRunning) return;
    setElapsedMs(0);
    startedAtRef.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    window.ecnpTimer?.notifyState?.("running");
  };

  const pauseTimer = async () => {
    if (!isRunning) return;
    const elapsed = Date.now() - (startedAtRef.current || Date.now());
    setElapsedMs(elapsed);
    startedAtRef.current = Date.now();
    setIsRunning(false);
    setIsPaused(true);
    window.ecnpTimer?.notifyState?.("paused");
    await appendElapsed(elapsed);
  };

  const resumeTimer = () => {
    if (isRunning) return;
    startedAtRef.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    window.ecnpTimer?.notifyState?.("running");
  };

  const stopTimer = async () => {
    if (!isRunning && !isPaused) return;
    let elapsed = 0;
    if (isRunning) {
      elapsed = Date.now() - (startedAtRef.current || Date.now());
      setElapsedMs(elapsed);
    }
    startedAtRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    window.ecnpTimer?.notifyState?.("stopped");
    if (elapsed > 0) await appendElapsed(elapsed);
    alert("Logged.");
  };

  /* Divide evenly: 8h → selected tasks */
  const divideEvenly = async () => {
    if (!window.ecnp?.appendDaily) { alert("Cannot write logs: preload API missing."); return; }
    if (selected.length === 0) { alert("Select tasks to divide among."); return; }
    const total = 8 * 60;
    const per = Math.floor(total / selected.length);
    const remainder = total - per * selected.length;
    const entries = selected.map((task, i) => ({ task, minutes: per + (i < remainder ? 1 : 0) }));
    await window.ecnp.appendDaily({ dateISO: todayISO(), user: storedUser, entries });
    alert(`${total} minutes divided evenly and saved for today.`);
  };

  /* Reports for any month/year (admin) */
  const generateMonthly = async () => {
    if (!window.ecnp?.generateMonthly) { alert("Cannot generate report: preload API missing."); return; }
    if (!/^\d{4}$/.test(reportYear)) { alert("Invalid year (YYYY)"); return; }
    const m = Number(reportMonth);
    if (!(m >= 1 && m <= 12)) { alert("Invalid month (MM)"); return; }
    try {
      const out = await window.ecnp.generateMonthly(Number(reportYear), m);
      alert(`Monthly report generated:\n${out}`);
    } catch (e) { alert("Report failed: " + (e?.message || e)); }
  };

  /* Settings actions */
  const openLogsDir = async () => { await window.ecnp?.openLogsDir?.(); };
  const testWrite = async () => {
    try { const f = await window.ecnp?.writeTestLog?.(); setSettingsMsg(`Wrote test file: ${f}`); }
    catch(e){ setSettingsMsg("Test write failed: " + (e?.message||e)); }
  };
  const overrideLogs = async () => {
    if (!isAdmin) { setSettingsMsg("Only admin can override logs folder."); return; }
    if (!overridePath.trim()) { setSettingsMsg("Please enter a valid path."); return; }
    try { await window.ecnp?.overrideLogsDir?.(storedUser, overridePath.trim()); setSettingsMsg("Logs directory override applied."); }
    catch(e){ setSettingsMsg("Override failed: " + (e?.message||e)); }
  };
  const toggleLaunchInTray = async () => {
    const nv = !launchInTray;
    setLaunchInTray(nv);
    localStorage.setItem("launch-in-tray", nv.toString());
    await window.ecnp?.setLaunchTray?.(nv);
  };

  /* ----------------------- LOGIN (name only) ----------------------- */
  if (!storedUser) {
    return (
      <div className="wrap stack" role="main" aria-label="Login" style={{maxWidth:960, margin:"0 auto", padding:24, fontFamily:"Segoe UI, system-ui, -apple-system, Arial"}}>
        <div className="topbar" style={topbarStyle}>
          <h1 style={appNameStyle}>ECNP Time Tracker</h1>
          <span style={mutedStyle}>Track your day in a few clicks</span>
        </div>

        <section className="panel" style={panelStyle} aria-labelledby="name-title">
          <h3 id="name-title" style={sectionTitleStyle}>Continue with your name</h3>
          <div className="field" style={{display:"flex", flexDirection:"column", gap:8}}>
            <label htmlFor="name-input" style={mutedStyle}>Your name</label>
            <input
              id="name-input" style={inputStyle}
              type="text" value={username} placeholder="e.g., admin"
              onChange={(e)=>setUsername(e.target.value)}
              onKeyDown={(e)=> e.key==="Enter" ? handleNameLogin() : null}
              aria-invalid={!!nameErr}
              aria-describedby={nameErr ? "name-error" : undefined}
            />
            {nameErr && <span id="name-error" style={{color:"#b42318", fontSize:13}}>{nameErr}</span>}
          </div>
          <div className="actions" style={{display:"flex", gap:10}}>
            <button className="btn ok" style={btnOk} onClick={handleNameLogin}>Continue</button>
            <button className="btn outline" style={btnOutline} onClick={()=>{ setUsername(""); setNameErr(""); }}>Clear</button>
          </div>
          <p style={{...mutedStyle, fontSize:13}}>Your name is saved locally so you don’t have to type it again next time.</p>
        </section>
      </div>
    );
  }

  /* ----------------------- TRAY MINI-MODE (Option 2) ----------------------- */
  if (isTrayMode) {
    const statusColor = isRunning ? "green" : isPaused ? "orange" : "gray";
    const statusLabel = isRunning ? "RUNNING" : isPaused ? "PAUSED" : "STOPPED";

    return (
      <div
        style={{
          padding: 16,
          fontFamily: "Segoe UI",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "100%"
        }}
        onMouseLeave={() => window.ecnpTimer?.trayHide?.()}
      >
        {/* User */}
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          <b>User:</b> {storedUser}
        </div>

        {/* Task selector */}
        <label style={{ fontSize: 13 }}>Task</label>
        <select
          value={selected[0] || ""}
          onChange={(e) => setSelected([e.target.value])}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            width: "100%"
          }}
        >
          <option value="">Select task...</option>
          {tasks.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Status row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {Math.floor(elapsedMs / 60000)}m {Math.floor((elapsedMs / 1000) % 60)}s
          </div>

          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: statusColor,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: statusColor
              }}
            ></span>
            {statusLabel}
          </div>
        </div>

        {/* Actions grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 8
          }}
        >
          {/* Start */}
          {!isRunning && !isPaused && (
            <button
              style={{
                padding: "10px",
                background: "green",
                color: "white",
                borderRadius: 6,
                border: "none",
                fontSize: 15,
                gridColumn: "span 2"
              }}
              onClick={startTimer}
            >
              Start
            </button>
          )}

          {/* Pause + Stop */}
          {isRunning && (
            <>
              <button
                style={{
                  padding: "10px",
                  background: "orange",
                  color: "white",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 15
                }}
                onClick={pauseTimer}
              >
                Pause
              </button>
              <button
                style={{
                  padding: "10px",
                  background: "red",
                  color: "white",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 15
                }}
                onClick={stopTimer}
              >
                Stop
              </button>
            </>
          )}

          {/* Resume + Stop */}
          {!isRunning && isPaused && (
            <>
              <button
                style={{
                  padding: "10px",
                  background: "green",
                  color: "white",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 15
                }}
                onClick={resumeTimer}
              >
                Resume
              </button>
              <button
                style={{
                  padding: "10px",
                  background: "red",
                  color: "white",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 15
                }}
                onClick={stopTimer}
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ----------------------- MAIN APP (window mode) ----------------------- */
  return (
    <div className="wrap stack" role="main" aria-label="Time tracker main" style={{maxWidth:960, margin:"0 auto", padding:24, fontFamily:"Segoe UI, system-ui, -apple-system, Arial"}}>
      {/* Top bar */}
      <header className="topbar" style={topbarStyle}>
        <h1 style={appNameStyle}>ECNP Time Tracker</h1>
        <div className="userBox" style={{display:"flex", alignItems:"center", gap:12}}>
          <button
            title="Settings" aria-label="Settings"
            onClick={() => setPage(p => p === "settings" ? "main" : "settings")}
            style={{...btnOutline, display:"grid", placeItems:"center", padding:"6px 8px"}}
          >
            <GearIcon size={18}/>
          </button>
          <div className="initial" aria-hidden="true" style={avatarStyle}>{userInitials}</div>
          <div>
            <div style={{fontWeight:600}}>{storedUser}</div>
            <div style={{...mutedStyle, fontSize:12}}>Signed in</div>
          </div>
          <button className="btn danger" style={btnDanger} onClick={handleLogout} aria-label="Log out">Log out</button>
        </div>
      </header>

      {/* Admin tasks */}
      {isAdmin && (
        <section className="panel" style={panelStyle} aria-label="Admin">
          <h3 style={sectionTitleStyle}>Admin — Manage Tasks</h3>
          <div className="row" style={{display:"flex", gap:16, alignItems:"center"}}>
            <div className="field" style={{flex:1}}>
              <label style={mutedStyle}>Add task</label>
              <div className="row" style={{display:"flex", gap:10}}>
                <input
                  style={{...inputStyle, flex:1}} placeholder="New task name"
                  value={newTask} onChange={(e)=>setNewTask(e.target.value)}
                  onKeyDown={(e)=> e.key==="Enter" ? addTask() : null}
                />
                <button style={btnOutline} onClick={addTask}>Add</button>
              </div>
            </div>
            <div>
              <button style={btnOk} onClick={saveTaskList}>Save tasks</button>
            </div>
          </div>
          <div style={dividerStyle}></div>
          <div className="row" style={{display:"flex", flexWrap:"wrap", gap:8}}>
            {tasks.map(t => (
              <div key={t} className="row" style={{display:"flex", alignItems:"center", gap:8, border:"1px solid #e8ebf0", borderRadius:8, padding:"6px 10px", background:"#fff"}}>
                <span>{t}</span>
                <button style={btnOutline} onClick={()=>removeTask(t)} title="Remove">×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2-column area */}
      <div className="twoCol" style={{display:"grid", gridTemplateColumns:"1.2fr .8fr", gap:16}}>
        {/* Left: Work area */}
        <section className="panel" style={panelStyle} aria-labelledby="work-title">
          <h3 id="work-title" style={sectionTitleStyle}>Today</h3>

          <div className="row" style={{display:"flex", gap:16, flexWrap:"wrap"}}>
            <div className="field" style={{flex:"1 1 220px"}}>
              <div style={{fontWeight:700}}>
                Date: {todayISO()}
                <span style={{ fontWeight: 400, marginLeft: 8 }}>— User: <b>{storedUser}</b></span>
              </div>
            </div>
            <div className="field" style={{flex:"2 1 320px"}}>
              <label style={mutedStyle}>Tasks (select multiple)</label>
              <div className="row" style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                {tasks.map(t => {
                  const on = selected.includes(t);
                  return (
                    <button
                      key={t}
                      className={`btn ${on ? "brand" : "outline"}`}
                      style={on ? btnBrand : btnOutline}
                      onClick={() => toggleSelected(t)}
                      aria-pressed={on}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bigger action buttons in window mode */}
          <div
            className="actions"
            style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}
          >
            {!isRunning && !isPaused && (
              <button
                className="btn ok"
                style={{ ...btnOk, padding: "16px 32px", fontSize: "20px" }}
                onClick={startTimer}
              >
                Start
              </button>
            )}

            {isRunning && (
              <>
                <button
                  className="btn outline"
                  style={{ ...btnOutline, padding: "16px 32px", fontSize: "20px" }}
                  onClick={pauseTimer}
                >
                  Pause
                </button>

                <button
                  className="btn outline"
                  style={{ ...btnOutline, padding: "16px 32px", fontSize: "20px" }}
                  onClick={stopTimer}
                >
                  Stop
                </button>
              </>
            )}

            {!isRunning && isPaused && (
              <>
                <button
                  className="btn ok"
                  style={{ ...btnOk, padding: "16px 32px", fontSize: "20px" }}
                  onClick={resumeTimer}
                >
                  Resume
                </button>

                <button
                  className="btn outline"
                  style={{ ...btnOutline, padding: "16px 32px", fontSize: "20px" }}
                  onClick={stopTimer}
                >
                  Stop
                </button>
              </>
            )}

            <button
              className="btn outline"
              style={{ ...btnOutline, padding: "12px 20px", fontSize: "16px" }}
              onClick={divideEvenly}
              title="Evenly divide 8h among selected tasks"
            >
              Divide evenly (8h)
            </button>

            <div style={{ marginLeft: "auto", fontSize: 18 }}>
              Elapsed: {Math.floor(elapsedMs / 60000)}m {Math.floor((elapsedMs / 1000) % 60)}s
            </div>
          </div>
        </section>

        {/* Right: Reports (admin only) */}
        {isAdmin && (
          <aside className="panel" style={panelStyle}>
            <h3 style={sectionTitleStyle}>Reports</h3>
            <div className="row" style={{display:"flex", gap:10, alignItems:"center", marginBottom: 6}}>
              <input
                style={{...inputStyle, width:100}}
                value={reportYear}
                onChange={(e)=>setReportYear(e.target.value)}
                placeholder="Year (YYYY)"
                aria-label="Report year"
              />
              <input
                style={{...inputStyle, width:80}}
                value={reportMonth}
                onChange={(e)=>setReportMonth(e.target.value)}
                placeholder="MM"
                aria-label="Report month"
              />
              <button className="btn outline" style={btnOutline} onClick={generateMonthly}>
                Generate monthly report
              </button>
            </div>
            <p style={{...mutedStyle, fontSize:13}}>
              Reports and logs are organized in monthly subfolders.
            </p>
          </aside>
        )}
      </div>

      {/* SETTINGS */}
      {page === "settings" && (
        <section className="panel" style={{...panelStyle, marginTop:16}} aria-label="Settings">
          <h3 style={sectionTitleStyle}>Settings</h3>

          {/* Logs folder */}
          <div className="field" style={{display:"grid", gridTemplateColumns:"1fr auto", gap:10, alignItems:"center"}}>
            <div>
              <div style={mutedStyle}>Detected logs folder</div>
              <div style={{fontSize:13, wordBreak:"break-all"}}>{logsDir || "Not available yet"}</div>
            </div>
            <div className="actions" style={{display:"flex", gap:10}}>
              <button style={btnOutline} onClick={openLogsDir}>Open folder</button>
              <button style={btnOutline} onClick={testWrite}>Test write</button>
            </div>
          </div>

          {/* Override logs (admin) */}
          {isAdmin && (
            <>
              <div style={dividerStyle}></div>
              <h4 style={{margin:"10px 0"}}>Admin: override logs folder</h4>
              <div className="field" style={{display:"flex", gap:10}}>
                <input
                  style={{...inputStyle, flex:1}}
                  placeholder="C:\\Path\\to\\shared\\logs"
                  value={overridePath}
                  onChange={(e)=>setOverridePath(e.target.value)}
                />
                <button style={btnOk} onClick={overrideLogs}>Save override</button>
              </div>
            </>
          )}

          {/* Startup toggle */}
          <div style={{marginTop:20}}>
            <h4 style={{margin:"10px 0"}}>Startup</h4>
            <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer"}}>
              <input type="checkbox" checked={launchInTray} onChange={toggleLaunchInTray}/>
              Launch app in tray mode at startup
            </label>
          </div>

          {settingsMsg && <p style={{marginTop:10}}>{settingsMsg}</p>}
          <div style={{marginTop:16}}>
            <button style={btnOutline} onClick={() => setPage("main")}>Back</button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ----------------------- Styles ----------------------- */
const mutedStyle = { color:"#68707a" };
const topbarStyle = {
  display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
  background:"#fff", border:"1px solid #e8ebf0", borderRadius:10, padding:"12px 16px",
  boxShadow:"0 1px 2px rgba(16,24,40,.04)"
};
const appNameStyle = { fontSize:20, fontWeight:700, letterSpacing:".2px", margin:0 };
const panelStyle = {
  background:"#fff", border:"1px solid #e8ebf0", borderRadius:10, padding:16,
  boxShadow:"0 1px 2px rgba(16,24,40,.04)"
};
const sectionTitleStyle = { margin:"0 0 12px 0", fontSize:16, fontWeight:700 };
const inputStyle = { width:"100%", padding:"10px 12px", border:"1px solid #e8ebf0", borderRadius:8, fontSize:14, outline:"none" };
const btnBase = { border:"none", borderRadius:8, padding:"10px 14px", fontWeight:600, cursor:"pointer", transition:".15s ease" };
const btnBrand = { ...btnBase, background:"#0a66c2", color:"#fff" };
const btnOk    = { ...btnBase, background:"#28a745", color:"#fff" };
const btnDanger= { ...btnBase, background:"#d9534f", color:"#fff" };
const btnOutline={ ...btnBase, background:"#fff", color:"#1b1f24", border:"1px solid #e8ebf0" };
const dividerStyle = { height:1, background:"#e8ebf0", margin:"12px 0" };
const avatarStyle  = { width:34, height:34, borderRadius:"50%", background:"#e9f2ff", color:"#0a4fad", display:"grid", placeItems:"center", fontWeight:700 };
