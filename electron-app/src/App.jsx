
// src/App.jsx — restored UI + working login
import React from "react";
import { msalInstance, loginRequest } from "./msalConfig";

export default function App() {

  const handleLogin = () => {
    console.log("User clicked login");
    msalInstance.loginRedirect(loginRequest);
  };

  return (
    <div style={{
      width: "900px",
      margin: "0 auto",
      padding: "30px",
      fontFamily: "Segoe UI, sans-serif",
    }}>
      
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <h1 style={{ margin: 0 }}>ECNP Time Tracker</h1>

        <button
          onClick={handleLogin}
          style={{
            background: "#0078D4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "10px 18px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600"
          }}
        >
          Sign in with Microsoft
        </button>
      </div>

      <h3>Date: {new Date().toISOString().split("T")[0]}</h3>

      {/* Task */}
      <label style={{ display: "block", marginBottom: "6px" }}>
        Task
      </label>

      <select style={{
        width: "100%",
        padding: "12px",
        marginBottom: "15px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        fontSize: "14px"
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

      <h3>Today’s entries</h3>
      <p>No entries yet.</p>
    </div>
  );
}
