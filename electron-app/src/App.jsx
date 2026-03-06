
// src/App.jsx — Combined Microsoft login + Username login

import React, { useState, useEffect } from "react";
import { msalInstance, loginRequest } from "./msalConfig";

export default function App() {
  const [storedUser, setStoredUser] = useState(null);
  const [username, setUsername] = useState("");

  // On app start → load stored username
  useEffect(() => {
    const saved = localStorage.getItem("ecnp-username");
    if (saved) {
      setStoredUser(saved);
    } else {
      // If MSAL has an account, use that instead
      const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
      if (account) setStoredUser(account.username);
    }
  }, []);

  // Login with username
  const handleNameLogin = () => {
    if (!username.trim()) return;
    localStorage.setItem("ecnp-username", username.trim());
    setStoredUser(username.trim());
  };

  // Logout clears both username & MSAL
  const handleLogout = () => {
    localStorage.removeItem("ecnp-username");
    msalInstance.logoutRedirect?.();
    setStoredUser(null);
    setUsername("");
  };

  // Microsoft login handler
  const handleMicrosoftLogin = () => {
    msalInstance.loginRedirect(loginRequest);
  };

  // If user NOT logged in → show hybrid login screen
  if (!storedUser) {
    return (
      <div style={{
        width: "900px",
        margin: "0 auto",
        padding: "30px",
        fontFamily: "Segoe UI, sans-serif",
        textAlign: "center"
      }}>
        <h1>ECNP Time Tracker</h1>
        <p>You can sign in either with Microsoft OR by typing your name.</p>

        {/* Microsoft login */}
        <button
          onClick={handleMicrosoftLogin}
          style={{
            background: "#0078D4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "12px 20px",
            cursor: "pointer",
            marginBottom: "20px",
            fontSize: "15px",
            fontWeight: 600
          }}
        >
          Sign in with Microsoft
        </button>

        <hr style={{ margin: "25px 0", opacity: 0.3 }} />

        {/* Username login */}
        <input
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            width: "260px",
            marginBottom: "10px"
          }}
        />

        <br />

        <button
          onClick={handleNameLogin}
          style={{
            background: "#28A745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "10px 20px",
            cursor: "pointer",
            marginTop: "10px",
            fontSize: "15px",
            fontWeight: 600
          }}
        >
          Continue with Name
        </button>
      </div>
    );
  }

  // If user IS logged in → show your restored UI
  return (
    <div style={{
      width: "900px",
      margin: "0 auto",
      padding: "30px",
      fontFamily: "Segoe UI, sans-serif"
    }}>
      
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <h1>ECNP Time Tracker</h1>

        <div>
          <span style={{ marginRight: "15px" }}>
            Logged in as <b>{storedUser}</b>
          </span>

          <button
            onClick={handleLogout}
            style={{
              background: "#D9534F",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "8px 14px",
              cursor: "pointer"
            }}
          >
            Log out
          </button>
        </div>
      </div>

      <h3>Date: {new Date().toISOString().split("T")[0]}</h3>

      <label style={{ display: "block", marginBottom: "6px" }}>
        Task
      </label>

      <select style={{
        width: "100%",
        padding: "12px",
        marginBottom: "15px",
        borderRadius: "4px",
        border: "1px solid #ccc"
      }}>
        <option>— Select task —</option>
      </select>

      <button style={{
        width: "100%",
        padding: "12px",
        background: "green",
        color: "white",
        border: "none",
        borderRadius: "4px",
        fontSize: "16px",
        marginBottom: "30px",
        cursor: "pointer"
      }}>
        Start
      </button>

      <h3>Auto-split time</h3>
      <button style={{
        padding: "10px 16px",
        background: "#404040",
        color: "white",
        border: "none",
        borderRadius: "4px",
        marginBottom: "30px",
        cursor: "pointer"
      }}>
        Divide day evenly
      </button>

      <h3>Today's entries</h3>
      <p>No entries yet.</p>
    </div>
  );
}
