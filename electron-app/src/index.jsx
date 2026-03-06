
// src/index.jsx — FINAL FIX
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import { msalInstance, loginRequest } from "./msalConfig";

async function initializeAuth() {
  // 1) Initialize MSAL BEFORE anything else
  await msalInstance.initialize();

  // 2) Handle redirect from OS (msal://redirect)
  const redirectUri = window.electronMSAL?.getRedirectUri?.();
  if (redirectUri) {
    console.log("Handling redirect:", redirectUri);
    await msalInstance.handleRedirectPromise(redirectUri);
  }

  // 3) Restore cached account
  const account =
    msalInstance.getActiveAccount() ||
    msalInstance.getAllAccounts()[0];

  if (account) {
    msalInstance.setActiveAccount(account);
  }
}

// Run initialization, then render UI
initializeAuth().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
