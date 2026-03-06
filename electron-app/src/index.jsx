
// src/index.jsx — FIXED FINAL VERSION
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import { msalInstance, loginRequest } from "./msalConfig";

async function start() {

  // 1) ALWAYS initialize MSAL fully first
  await msalInstance.initialize();

  // 2) Handle redirect if one occurred
  const redirectUrl = window.electronMSAL.getRedirectUri?.();
  if (redirectUrl) {
    console.log("Handling redirect:", redirectUrl);
    await msalInstance.handleRedirectPromise(redirectUrl);
  }

  // 3) Only AFTER MSAL initializes + redirect resolves, render UI
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App msalInstance={msalInstance} loginRequest={loginRequest} />
    </React.StrictMode>
  );
}

// Guaranteed MSAL-first bootstrap
start();
``
