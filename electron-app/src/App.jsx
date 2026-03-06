
// src/App.jsx — Dual login (Microsoft + name), admin="admin", tasks, multi-task timer,
// divide-evenly (8h), daily CSV logs, monthly Excel report, Settings page, refreshed UI.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { msalInstance, loginRequest } from "./msalConfig";

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
  /* Auth state (dual login) */
  const [storedUser, setStoredUser] = useState(null);     // either MSAL username or local name
  const [username, setUsername] = useState("");           // input field for name-login
  const [nameErr, setNameErr] = useState("");

  /* Navigation (main/settings) */
  const [page, setPage] = useState("main");               // "main" | "settings"

  /* Tasks (admin-managed) */
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  /* Selection & timer */
  const [selected, setSelected] = useState([]);           // selected tasks (multi)
  const [isRunning, setIsRunning] = useState(false);
  const startedAtRef = useRef(null);

  /* Monthly report input */
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  /* Settings: logs folder info & override (admin) */
  const [logsDir, setLogsDir] = useState("");
  const [overridePath, setOverridePath] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");

  const isAdmin = storedUser === "admin";
  const userInitials = useMemo(() => initialsFor(storedUser || username), [storedUser, username]);

  /* ----------------------- Load identity from cache ----------------------- */
  useEffect(() => {
    // Name-based auto-login
    const saved = localStorage.getItem("ecnp-username");
    if (saved) {
      setStoredUser(saved);
      return;
    }
    // MSAL account cache
    const acct = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
    if (acct?.username) setStoredUser(acct.username);
  }, []);

  /* ----------------------- Load tasks at startup ----------------------- */
  useEffect(() => {
    if (!window.ecnp?.loadTasks) {
      // Fallback defaults if preload IPC isn't ready
      setTasks(["Focus work", "Meetings", "Support", "Admin"]);
      return;
    }
    window.ecnp.loadTasks()
      .then(arr => Array.isArray(arr) ? setTasks(arr) : setTasks(["Focus work","Meetings","Support","Admin"]))
      .catch(() => setTasks(["Focus work","Meetings","Support","Admin"]));
  }, []);

  /* ----------------------- Load Settings (logs dir) ----------------------- */
  useEffect(() => {
    if (window.ecnp?.getLogsDir) {
      window.ecnp.getLogsDir().then(setLogsDir).catch(() => {});
    }
  }, []);

  /* ----------------------- Dual-login handlers ----------------------- */
  const handleMicrosoftLogin = () => {
    // Redirect login; MSAL docs: navigation happens, don't continue code after this. [2](blob:https://outlook.office.com/1348328c-3cba-4512-b3c1-d64ec265774f)
    msalInstance.loginRedirect(loginRequest);
  };
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
    try { msalInstance.logoutRedirect?.(); } catch {}
    setStoredUser(null);
    setUsername("");
  };

  /* ----------------------- Admin: task management ----------------------- */
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
    if (!window.ecnp?.saveTasks) { alert("Cannot save tasks: preload API missing."); return; }
    try {
      await window.ecnp.saveTasks(storedUser, tasks);
      alert("Tasks saved.");
    } catch (e) {
      alert("Saving tasks failed: " + (e?.message || e));
    }
  };

  /* ----------------------- Task selection ----------------------- */
  const toggleSelected = (t) => {
    setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  /* ----------------------- Timer logic (simultaneous for all selected tasks) ----------------------- */
  const startTimer = () => {
    if (selected.length === 0) { alert("Select at least one task."); return; }
    if (isRunning) return;
    startedAtRef.current = Date.now();
    setIsRunning(true);
  };
  const pauseTimer = async () => {
    if (!isRunning) return;
    const elapsedMs = Date.now() - (startedAtRef.current || Date.now());
    startedAtRef.current = Date.now();
    await appendElapsed(elapsedMs);
    setIsRunning(false);
  };
  const stopTimer = async () => {
    if (!isRunning) return;
    const elapsedMs = Date.now() - (startedAtRef.current || Date.now());
    startedAtRef.current = null;
    setIsRunning(false);
    await appendElapsed(elapsedMs);
    alert("Logged.");
  };
  async function appendElapsed(ms) {
    if (!window.ecnp?.appendDaily) { alert("Cannot write logs: preload API missing."); return; }
    const minutes = Math.max(1, Math.round(ms / 60000)); // ensure at least 1 minute logged
    // Simultaneous logging: each selected task gets the full minutes
    const entries = selected.map(task => ({ task, minutes }));
    await window.ecnp.appendDaily({
      dateISO: todayISO(),
      user: storedUser,
      entries
    });
  }

  /* ----------------------- Divide evenly: 8h among selected tasks ----------------------- */
  const divideEvenly = async () => {
    if (!window.ecnp?.appendDaily) { alert("Cannot write logs: preload API missing."); return; }
    if (selected.length === 0) { alert("Select tasks to divide among."); return; }
    const total = 8 * 60; // 480 minutes
    const per = Math.floor(total / selected.length);
    const remainder = total - per * selected.length;
    const entries = selected.map((task, i) => ({ task, minutes: per + (i < remainder ? 1 : 0) }));
    await window.ecnp.appendDaily({
      dateISO: todayISO(),
      user: storedUser,
      entries
    });
    alert("8 hours divided evenly and saved for today.");
  };

  /* ----------------------- Monthly report ----------------------- */
  const generateMonthly = async () => {
    if (!window.ecnp?.generateMonthly) { alert("Cannot generate report: preload API missing."); return; }
    if (!/^\d{4}-\d{2}$/.test(reportMonth)) { alert("Use YYYY-MM format."); return; }
    const [y, m] = reportMonth.split("-");
    try {
      const out = await window.ecnp.generateMonthly(Number(y), Number(m));
      alert(`Monthly report generated:\n${out}`);
    } catch (e) {
      alert("Report failed: " + (e?.message || e));
    }
  };

  /* ----------------------- Settings actions ----------------------- */
  const openLogsDir = async () => {
    if (!window.ecnp?.openLogsDir) { alert("Cannot open folder: preload API missing."); return; }
    await window.ecnp.openLogsDir();
  };
  const testWrite = async () => {
    if (!window.ecnp?.writeTestLog) { alert("Cannot test write: preload API missing."); return; }
    try {
      const file = await window.ecnp.writeTestLog();
      setSettingsMsg(`Wrote test file: ${file}`);
    } catch (e) {
      setSettingsMsg(`Test write failed: ${e?.message || e}`);
    }
  };
  const overrideLogs = async () => {
    if (!isAdmin) { setSettingsMsg("Only admin can override logs folder."); return; }
    if (!overridePath.trim()) { setSettingsMsg("Please enter a valid path."); return; }
    if (!window.ecnp?.overrideLogsDir) { setSettingsMsg("Override API missing."); return; }
    try {
      await window.ecnp.overrideLogsDir(storedUser, overridePath.trim());
      setSettingsMsg("Logs directory override applied. Restart recommended.");
    } catch (e) {
      setSettingsMsg("Override failed: " + (e?.message || e));
    }
  };

  /* ----------------------- Login screen (two-panel) ----------------------- */
  if (!storedUser) {
    return (
      <div className="wrap stack" role="main" aria-label="Login options" style={{maxWidth:960, margin:"0 auto", padding:24, fontFamily:"Segoe UI, system-ui, -apple-system, Arial"}}>
        <div className="topbar" style={topbarStyle}>
          <h1 style={appNameStyle}>ECNP Time Tracker</h1>
          <span style={mutedStyle}>Track your day in a few clicks</span>
        </div>

        <div className="row" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
          {/* Microsoft sign-in */}
          <section className="panel" style={panelStyle} aria-labelledby="ms-title">
            <h3 id="ms-title" style={sectionTitleStyle}>Sign in with Microsoft</h3>
            <p style={{...mutedStyle, marginTop:-6}}>
              Use your organizational account to sync with company services.
            </p>
            <button className="btn brand" style={btnBrand} onClick={handleMicrosoftLogin} aria-label="Sign in with Microsoft">
              Sign in with Microsoft
            </button>
            <div style={dividerStyle}></div>
            <p style={{...mutedStyle, fontSize:13}}>
              Having issues with Microsoft sign‑in? Use your name instead on the right — you can switch later.
            </p>
          </section>

          {/* Name login */}
          <section className="panel" style={panelStyle} aria-labelledby="name-title">
            <h3 id="name-title" style={sectionTitleStyle}>Continue with your name</h3>
            <div className="field" style={{display:"flex", flexDirection:"column", gap:8}}>
              <label htmlFor="name-input" style={mutedStyle}>Your name</label>
              <input
                id="name-input"
                style={inputStyle}
                type="text"
                value={username}
                placeholder="e.g., admin"
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => (e.key === "Enter" ? handleNameLogin() : null)}
                aria-invalid={!!nameErr}
                aria-describedby={nameErr ? "name-error" : undefined}
              />
              {nameErr && <span id="name-error" style={{color:"#b42318", fontSize:13}}>{nameErr}</span>}
            </div>
            <div className="actions" style={{display:"flex", gap:10}}>
              <button className="btn ok" style={btnOk} onClick={handleNameLogin}>Continue</button>
              <button className="btn outline" style={btnOutline} onClick={() => { setUsername(""); setNameErr(""); }}>
                Clear
              </button>
            </div>
            <p style={{...mutedStyle, fontSize:13}}>
              Your name is saved locally so you don’t have to type it again next time.
            </p>
          </section>
        </div>
      </div>
    );
  }

  /* ----------------------- Main app (after login) ----------------------- */
  return (
    <div className="wrap stack" role="main" aria-label="Time tracker main" style={{maxWidth:960, margin:"0 auto", padding:24, fontFamily:"Segoe UI, system-ui, -apple-system, Arial"}}>
      {/* Top bar */}
      <header className="topbar" style={topbarStyle}>
        <h1 style={appNameStyle}>ECNP Time Tracker</h1>

        <div className="userBox" style={{display:"flex", alignItems:"center", gap:12}}>
          <button
            title="Settings"
            aria-label="Settings"
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

      {/* SETTINGS PAGE */}
      {page === "settings" ? (
        <section className="panel" style={panelStyle} aria-label="Settings">
          <h3 style={sectionTitleStyle}>Settings</h3>

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

          {isAdmin && (
            <>
              <div style={dividerStyle}></div>
              <h4 style={{margin:"10px 0"}}>Admin: override logs folder</h4>
              <div className="field" style={{display:"flex", gap:10}}>
                <input
                  style={{...inputStyle, flex:1}}
                  placeholder="C:\\Path\\to\\your\\shared\\logs"
                  value={overridePath}
                  onChange={(e)=>setOverridePath(e.target.value)}
                />
                <button style={btnOk} onClick={overrideLogs}>Save override</button>
              </div>
              <p style={{...mutedStyle, fontSize:12}}>
                Restart recommended after changing logs folder.
              </p>
            </>
          )}

          {settingsMsg && <p style={{marginTop:10}}>{settingsMsg}</p>}

          <div style={{marginTop:16}}>
            <button style={btnOutline} onClick={() => setPage("main")}>Back</button>
          </div>
        </section>
      ) : (
        <>
          {/* Admin panel (admin only) */}
          {isAdmin && (
            <section className="panel" style={panelStyle} aria-label="Admin">
              <h3 style={sectionTitleStyle}>Admin — Manage Tasks</h3>
              <div className="row" style={{display:"flex", gap:16, alignItems:"center"}}>
                <div className="field" style={{flex:1}}>
                  <label style={mutedStyle}>Add task</label>
                  <div className="row" style={{display:"flex", gap:10}}>
                    <input
                      style={{...inputStyle, flex:1}}
                      placeholder="New task name"
                      value={newTask}
                      onChange={(e)=>setNewTask(e.target.value)}
                      onKeyDown={(e)=> e.key==="Enter" ? addTask() : null}
                    />
                    <button style={btnOutline} onClick={addTask}>Add</button>
                  </div>
                </div>
                <div>
                  <button style={btnOk} onClick={saveTaskList} title="Save task list">Save tasks</button>
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

          {/* 2-column content */}
          <div className="twoCol" style={{display:"grid", gridTemplateColumns:"1.2fr .8fr", gap:16}}>
            {/* Left: Work area */}
            <section className="panel" style={panelStyle} aria-labelledby="work-title">
              <h3 id="work-title" style={sectionTitleStyle}>Today</h3>

              <div className="row" style={{display:"flex", gap:16, flexWrap:"wrap"}}>
                <div className="field" style={{flex:"1 1 180px"}}>
                  <label style={mutedStyle}>Date</label>
                  <div style={{fontWeight:700}}>{todayISO()}</div>
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
                          onClick={()=>toggleSelected(t)}
                          aria-pressed={on}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="actions" style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                {!isRunning && <button className="btn ok" style={btnOk} onClick={startTimer}>Start</button>}
                {isRunning && (
                  <>
                    <button className="btn outline" style={btnOutline} onClick={pauseTimer}>Pause</button>
                    <button className="btn outline" style={btnOutline} onClick={stopTimer}>Stop</button>
                  </>
                )}
                <button className="btn outline" style={btnOutline} onClick={divideEvenly} title="Evenly divide 8 hours among selected tasks">
                  Divide evenly (8h)
                </button>
              </div>
            </section>

            {/* Right: Reports & notes */}
            <aside className="panel" style={panelStyle} aria-labelledby="entries-title">
              <h3 id="entries-title" style={sectionTitleStyle}>Reports</h3>
              <div className="row" style={{display:"flex", gap:10, alignItems:"center"}}>
                <input
                  style={{...inputStyle, maxWidth:180}}
                  value={reportMonth}
                  onChange={(e)=>setReportMonth(e.target.value)}
                  placeholder="YYYY-MM"
                  aria-label="Report month"
                />
                <button className="btn outline" style={btnOutline} onClick={generateMonthly}>Generate monthly report</button>
              </div>
              <p style={{...mutedStyle, fontSize:13, marginTop:8}}>
                The report is saved in the shared logs folder and includes a monthly task summary and a per‑user breakdown.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------- minimal inline styles (Fluent-like) ----------------------- */
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
const inputStyle = {
  width:"100%", padding:"10px 12px", border:"1px solid #e8ebf0", borderRadius:8,
  fontSize:14, outline:"none"
};
const btnBase = {
  border:"none", borderRadius:8, padding:"10px 14px", fontWeight:600, cursor:"pointer", transition:".15s ease"
};
const btnBrand = { ...btnBase, background:"#0a66c2", color:"#fff" };
const btnOk    = { ...btnBase, background:"#28a745", color:"#fff" };
const btnDanger= { ...btnBase, background:"#d9534f", color:"#fff" };
const btnOutline={ ...btnBase, background:"#fff", color:"#1b1f24", border:"1px solid #e8ebf0" };
const dividerStyle = { height:1, background:"#e8ebf0", margin:"12px 0" };
const avatarStyle  = { width:34, height:34, borderRadius:"50%", background:"#e9f2ff", color:"#0a4fad",
                       display:"grid", placeItems:"center", fontWeight:700 };
