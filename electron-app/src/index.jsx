
// --------------------------------------
// src/index.jsx — FINAL WORKING VERSION
// --------------------------------------

import React from "react";
import ReactDOM from "react-dom/client";

import { msalInstance, loginRequest } from "./msalConfig";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import App from "./App.jsx";

// MSAL bootstrap (must run BEFORE rendering)
async function bootstrapAuth() {

  // MSAL v3+ requires initialization before anything else
  await msalInstance.initialize().catch((err) => {
    console.error("MSAL initialization failed:", err);
  });

  // 1) Process redirect result
  const redirectResult = await msalInstance.handleRedirectPromise().catch((err) => {
    console.warn("handleRedirectPromise error:", err);
    return null;
  });

  if (redirectResult?.account) {
    msalInstance.setActiveAccount(redirectResult.account);
  }

  // 2) Try to get active or cached account
  let account =
    msalInstance.getActiveAccount() ||
    msalInstance.getAllAccounts()[0];

  if (!account) {
    console.log("No active account — starting loginRedirect()");
    await msalInstance.loginRedirect(loginRequest);
    return;
  }

  // 3) Acquire token silently
  try {
    const tokenResponse = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });

    console.log("Access token acquired:", tokenResponse.accessToken.substring(0, 25), "…");

  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      console.log("Silent token failed → triggering interactive login");
      await msalInstance.acquireTokenRedirect(loginRequest);
      return;
    }
    console.error("Token acquisition error:", err);
  }
}

// Run authentication bootstrap, then render UI
bootstrapAuth().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
