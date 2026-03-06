
// App.jsx — FINAL WORKING VERSION

import React from "react";
import { msalInstance, loginRequest } from "./msalConfig";

function App() {

  // ------------------------------------------
  // 1. LOGIN BUTTON HANDLER (PLACE HERE)
  // ------------------------------------------
  const handleLogin = () => {
    console.log("Sign-in button clicked");
    msalInstance.loginRedirect(loginRequest);
  };

  // ------------------------------------------
  // 2. UI RENDER
  // ------------------------------------------
  return (
    <div style={{ padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>ECNP Time Tracker</h1>

        {/* This is your existing button — now wired correctly */}
        <button 
          onClick={handleLogin} 
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Sign in with Microsoft
        </button>
      </div>

      {/* The rest of your UI below */}
      <h3>Date: 2026-03-06</h3>

      <label>Task</label>
      <select style={{ display: "block", marginBottom: "12px" }}>
        <option>— Select task —</option>
      </select>

      <button style={{ background: "green", color: "white", padding: "10px" }}>
        Start
      </button>

      <h3>Auto-split time</h3>
      <button>Divide day evenly</button>

      <h3>Today's entries</h3>
      <p>No entries yet.</p>
    </div>
  );
}

export default App;
