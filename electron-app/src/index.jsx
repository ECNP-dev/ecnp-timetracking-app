
// --------------------------------------
// src/index.jsx — FINAL WORKING VERSION
// --------------------------------------

import React from "react";
import ReactDOM from "react-dom/client";

// MSAL imports
import { msalInstance, loginRequest } from "./msalConfig";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

// Your app
import App from "./App.jsx";

// --------------------------------------------------
// MSAL LOGIN/TOKEN BOOTSTRAP (must run BEFORE render)
// --------------------------------------------------

async function bootstrapAuth() {

  // 1) Handle redirect result FIRST
  const redirectResult = await msalInstance.handleRedirectPromise().catch((err) => {
    console.warn("handleRedirectPromise error:", err);
    return null;
  });

  // If loginRedirect returned an account, set it now
  if (redirectResult?.account) {
    msalInstance.setActiveAccount(redirectResult.account);
  }

  // 2) Try to get an existing signed‑in account
  let account =
    msalInstance.getActiveAccount() ||
    msalInstance.getAllAccounts()[0];

  // If no cached account → start login
  if (!account) {
    console.log("No active account — starting loginRedirect()");
    await msalInstance.loginRedirect(loginRequest);
    return; // App will restart after redirect
  }

  // 3) Try silent token
  try {
    const tokenResponse = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });

    console.log(
      "Access token acquired:",
      tokenResponse.accessToken.substring(0, 20),
      "…"
    );
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      console.log("Silent token failed → triggering interactive login...");
      await msalInstance.acquireTokenRedirect(loginRequest);
      return;
    }
    console.error("Token acquisition error:", err);
  }
}

// Start MSAL before rendering
bootstrapAuth().then(() => {
  // Render your app AFTER MSAL login process is complete
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
