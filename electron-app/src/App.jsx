
import React, { useState } from "react";

export default function App() {
  const [me, setMe] = useState(null);
  const [token, setToken] = useState(null);

  const handleLogin = async () => {
    try {
      const res = await window.auth.login();
      setMe(res?.account || null);
      setToken(res?.accessToken || null);
      console.log("Signed in:", res?.account?.username, "token:", (res?.accessToken || "").slice(0, 20), "…");
    } catch (e) {
      console.error("Login failed:", e);
      alert("Login failed: " + (e?.message || e));
    }
  };

  return (
    <div style={{ width: 900, margin: "0 auto", padding: 30, fontFamily: "Segoe UI, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems:"center" }}>
        <h1>ECNP Time Tracker</h1>
        {!me ? (
          <button onClick={handleLogin}
            style={{ background:"#0078D4", color:"#fff", border:"none", borderRadius:4, padding:"10px 16px", fontWeight:600, cursor:"pointer" }}>
            Sign in with Microsoft
          </button>
        ) : (
          <div>Signed in as <b>{me?.username || me?.homeAccountId}</b></div>
        )}
      </div>

      {/* … your existing UI (date, task picker, Start button, etc.) … */}
    </div>
  );
}
``
