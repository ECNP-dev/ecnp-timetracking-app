
// src/App.jsx — FINAL (no Microsoft login)
// - Name-only login
// - Admin="admin"
// - Working-hours settings (affect Divide evenly total)
// - Monthly subfolders for logs/reports (main.js handles filesystem)
// - Admin-only reports (any year/month)
// - Remember last selected tasks per user
// - Live timer with Pause/Resume/Stop
// - Tray mini-mode (#/tray) with Start/Pause/Resume/Stop, elapsed, auto-hide mouse leave
// - Date + User displayed

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
  // Auth (name-only)
  const [storedUser, setStoredUser] = useState(null);
  const [username, setUsername] = useState("");
  const [nameErr, setNameErr] = useState("");

  // Navigation
  const [page, setPage] = useState("main"); // "main" | "settings"

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  // Selection & timer
  const [selected, setSelected] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const startedAtRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Reports (any month/year)
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));

  // Settings (logs path, override, working hours, startup)
  const [logsDir, setLogsDir] = useState("");
  const [overridePath, setOverridePath] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [launchInTray, setLaunchInTray] = useState(false);
  const [wh, setWh] = useState({
    week: {
      mon:{start:"08:30", end:"17:00", breakMins:60},
      tue:{start:"08:30", end:"17:00", breakMins:60},
      wed:{start:"08:30", end:"17:00", breakMins:60},
      thu:{start:"08:30", end:"17:00", breakMins:60},
      fri:{start:"08:30", end:"17:00", breakMins:60},
      sat:{start:"00:00", end:"00:00", breakMins:0},
      sun:{start:"00:00", end:"00:00", breakMins:0}
    }
  });

  const isTrayMode = window.location.hash === "#/tray";
  const isAdmin = storedUser === "admin";
  const userInitials = useMemo(() => initialsFor(storedUser || username), [storedUser, username]);

  // Load name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ecnp-username");
    if (saved) setStoredUser(saved);
  }, []);

  // Load tasks
  useEffect(() => {
    window.ecnp?.loadTasks?.()
      .then(arr => Array.isArray(arr) ? setTasks(arr) : setTasks(["Focus work","Meetings","Support","Admin"]))
      .catch(() => setTasks(["Focus work","Meetings","Support","Admin"]));
  }, []);

  // Logs dir + startup toggle
  useEffect(() => {
    window.ecnp?.getLogsDir?.().then(setLogsDir).catch(()=>{});
    const saved = localStorage.getItem("launch-in-tray");
    if (saved === "true") setLaunchInTray(true);
  }, []);

  // Working hours (per user)
  useEffect(() => {
    if (!storedUser) return;
    window.ecnp?.getWorkingHours?.(storedUser).then(setWh).catch(()=>{});
  }, [storedUser]);

  // Remember last selected tasks per user
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

  // Elapsed counter while running
  useEffect(() => {
    let id = null;
    if (isRunning) {
      const started = startedAtRef.current;
      id = setInterval(() => setElapsedMs(Date.now() - started), 1000);
    }
    return () => clearInterval(id);
  }, [isRunning]);

  // Global toggle (Ctrl+Alt+L)
  useEffect(() => {
    const handler = () => {
      if (isRunning) stopTimer();
      else if (isPaused) resumeTimer();
      else startTimer();
    };
    window.ecnpTimer?.onGlobalToggle?.(handler);
  }, [isRunning, isPaused, selected]);

  // Helpers for working hours
  function minutesFrom(t) { const [h,m] = t.split(":").map(Number); return (h||0)*60 + (m||0); }
  function todayDailyMinutes() {
    const d = new Date().getDay(); // 0..6 => Sun..Sat
    const map = ["sun","mon","tue","wed","thu","fri","sat"];
    const day = wh?.week?.[map[d]];
    if (!day) return 480;
    const total = Math.max(0, minutesFrom(day.end) - minutesFrom(day.start) - (day.breakMins||0));
    return total || 480;
  }

  // Login (name)
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

  // Admin tasks
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

  // Selection chips
  const toggleSelected = (t) => {
    setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // Timer core
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

  // Divide evenly uses today's configured minutes
  const divideEvenly = async () => {
    if (!window.ecnp?.appendDaily) { alert("Cannot write logs: preload API missing."); return; }
    if (selected.length === 0) { alert("Select tasks to divide among."); return; }
    const total = todayDailyMinutes();
    const per = Math.floor(total / selected.length);
    const remainder = total - per * selected.length;
    const entries = selected.map((task, i) => ({ task, minutes: per + (i < remainder ? 1 : 0) }));
    await window.ecnp.appendDaily({ dateISO: todayISO(), user: storedUser, entries });
    alert(`${total} minutes divided evenly and saved for today.`);
  };

  // Reports for any month/year (admin)
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

  // Settings actions
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
  const saveWorkingHours = async () => {
    try { await window.ecnp?.saveWorkingHours?.(storedUser, wh); alert("Working hours saved."); }
    catch(e){ alert("Save failed: " + (e?.message||e)); }
  };

  // ----------------------- LOGIN SCREEN -----------------------
  if (!storedUser) {
    return (
      <div className="wrap stack" role="main" aria-label="Login options" style={{maxWidth:960, margin:"0 auto", padding:24, fontFamily:"Segoe UI, system-ui, -apple-system, Arial"}}>
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

  // ----------------------- TRAY MINI MODE -----------------------
  if (isTrayMode) {
    return (
      <div
        style={{ padding: 16, fontFamily: "Segoe UI" }}
        onMouseLeave={() => window.ecnpTimer?.trayHide?.()}
      >
        <h3 style={{ marginTop: 0 }}>Quick Log</h3>

        <div style={{ fontSize: 13, marginBottom: 6 }}>
          <b>User:</b> {storedUser}
        </div>

        <label style={{ fontSize: 13, marginBottom: 4 }}>Tasks</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {tasks.map(t => {
            const on = selected.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleSelected(t)}
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc",
                  background: on ? "#0a66c2" : "white", color: on ? "white" : "#333", cursor: "pointer"
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 12, fontSize: 16 }}>
          Elapsed: {Math.floor(elapsedMs/60000)}m {Math.floor((elapsedMs/1000)%60)}s
        </div>

        {isRunning && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={pauseTimer} style={{ padding: "10px", background: "#f0ad4e", color: "#fff", border: "none", borderRadius: 6, fontSize: 15 }}>Pause</button>
            <button onClick={stopTimer} style={{ padding: "10px", background: "red", color: "white", border: "none", borderRadius: 6, fontSize: 15 }}>Stop</button>
          </div>
        )}
        {!isRunning && isPaused && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={resumeTimer} style={{ padding: "10px", background: "green", color: "white", border: "none", borderRadius: 6, fontSize: 15 }}>Resume</button>
            <button onClick={stopTimer} style={{ padding: "10px", background: "red", color: "white", border: "none", borderRadius: 6, fontSize: 15 }}>Stop</button>
          </div>
        )}
        {!isRunning && !isPaused && (
          <button onClick={startTimer} style={{ width: "100%", padding: "10px", background: "green", color: "white", border: "none", borderRadius: 6, fontSize: 15 }}>
            Start
          </button>
        )}
      </div>
    );
  }

  // ----------------------- MAIN APP (after login) -----------------------
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

      {/* 2-column main area */}
      <div className="twoCol" style={{display:"grid", gridTemplateColumns:"1.2fr .8fr", gap:16}}>
        {/* Left: Work area */}
        <section className="panel" style={panelStyle} aria-labelledby="work-title">
          <h3 id="work-title" style={sectionTitleStyle}>Today</h3>

          <div className="row" style={{display:"flex", gap:16, flexWrap:"wrap"}}>
            <div className="field" style={{flex:"1 1 180px"}}>
              <div style={{fontWeight:700}}>Date: {todayISO()}
                <span style={{ fontWeight: 400, marginLeft: 8 }}>
                  — User: <b>{storedUser}</b>
                </span>
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

          <div className="actions" style={{display:"flex", gap:10, flexWrap:"wrap", alignItems:"center"}}>
            {!isRunning && !isPaused && <button className="btn ok" style={btnOk} onClick={startTimer}>Start</button>}
            {isRunning && (
              <>
                <button className="btn outline" style={btnOutline} onClick={pauseTimer}>Pause</button>
                <button className="btn outline" style={btnOutline} onClick={stopTimer}>Stop</button>
              </>
            )}
            {!isRunning && isPaused && (
              <>
                <button className="btn ok" style={btnOk} onClick={resumeTimer}>Resume</button>
                <button className="btn outline" style={btnOutline} onClick={stopTimer}>Stop</button>
              </>
            )}
            <button className="btn outline" style={btnOutline} onClick={divideEvenly} title="Evenly divide today's configured minutes among selected tasks">
              Divide evenly
            </button>

            <div style={{ marginLeft: "auto", fontSize: 16 }}>
              Elapsed: {Math.floor(elapsedMs/60000)}m {Math.floor((elapsedMs/1000)%60)}s
            </div>
          </div>
        </section>

        {/* Right: Reports (admin) */}
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

      {/* SETTINGS PAGE */}
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

          {/* Working hours */}
          <div style={{marginTop:16}}>
            <h4 style={{margin:"10px 0"}}>Working hours (per day)</h4>
            {["mon","tue","wed","thu","fri","sat","sun"].map(k => (
              <div key={k} style={{display:"grid", gridTemplateColumns:"90px 110px 110px 140px", gap:10, alignItems:"center", marginBottom:6}}>
                <label style={{textTransform:"capitalize"}}>{k}</label>
                <input style={inputStyle} value={wh.week[k].start}
                  onChange={e=>setWh(prev=>({...prev, week:{...prev.week, [k]:{...prev.week[k], start:e.target.value}}}))}/>
                <input style={inputStyle} value={wh.week[k].end}
                  onChange={e=>setWh(prev=>({...prev, week:{...prev.week, [k]:{...prev.week[k], end:e.target.value}}}))}/>
                <input style={inputStyle} type="number" min="0" value={wh.week[k].breakMins}
                  onChange={e=>setWh(prev=>({...prev, week:{...prev.week, [k]:{...prev.week[k], breakMins:Number(e.target.value)||0}}}))}/>
              </div>
            ))}
            <div className="actions" style={{display:"flex", gap:10, marginTop:8, alignItems:"center"}}>
              <button className="btn ok" style={btnOk} onClick={saveWorkingHours}>Save working hours</button>
              <div style={{...mutedStyle, fontSize:12}}>
                Today’s configured minutes: <b>{todayDailyMinutes()}</b>
              </div>
            </div>
          </div>

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
const avatarStyle  = { width:34, height:34, borderRadius:"50%", background:"#e9f2ff", color:"#0a4fad", display:"grid", placeItems:"center", fontWeight:700 };
``
