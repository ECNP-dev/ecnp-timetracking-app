
// src/index.jsx — FINAL WORKING VERSION FOR ELECTRON + MSAL
import React from "react";
import ReactDOM from "react-dom/client";

import { msalInstance, loginRequest } from "./msalConfig";
import App from "./App.jsx";

async function bootstrapAuth() {
  // REQUIRED: initialize MSAL first
  await msalInstance.initialize();

  // 1) Capture msal://redirect from Electron's main process
  const redirectUri = window.electronMSAL.getRedirectUri();
  if (redirectUri) {
    console.log("Renderer: handling redirect:", redirectUri);
    await msalInstance.handleRedirectPromise(redirectUri);
  }

  // 2) Determine active or cached account
  let account =
    msalInstance.getActiveAccount() ||
    msalInstance.getAllAccounts()[0];

  // 3) No account? Start loginRedirect manually
  //    (UI will appear first, login triggered by user button)
  if (!account) {
    console.log("No account — user must click Login");
    return; // IMPORTANT: do NOT auto-login
  }

  // 4) Acquire token silently now that user is authenticated
  try {
    const token = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    console.log("Token OK:", token.accessToken.substring(0, 20), "…");
  } catch (err) {
    console.warn("Silent token failed:", err);
  }
}

// Initialize MSAL before rendering UI
bootstrapAuth().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
