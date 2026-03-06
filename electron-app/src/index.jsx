
// -------------------------------
// src/index.jsx (FINAL WORKING VERSION)
// -------------------------------

// MSAL imports
import { msalInstance } from "./msalConfig";
import { loginRequest } from "./msalConfig";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

// React imports
import React from "react";
import ReactDOM from "react-dom/client";

// Your app root
import App from "./App.jsx";

// --------------------------------------
// 1) MSAL login + token bootstrap logic
// --------------------------------------

async function ensureLoginAndToken() {
  // STEP A — Process redirect result (must be first)
  const result = await msalInstance.handleRedirectPromise().catch((e) => {
    console.warn("handleRedirectPromise error:", e);
    return null;
  });

  // If redirect returned an account, set it as active
  if (result?.account) {
    msalInstance.setActiveAccount(result.account);
  }

  // STEP B — Determine current account
  let account =
    msalInstance.getActiveAccount() ||
    msalInstance.getAllAccounts()[0];

  // If no signed‑in account, begin login flow
  if (!account) {
    console.log("No account in cache — starting loginRedirect()");
    await msalInstance.loginRedirect(loginRequest);
    return; // Flow continues after redirect
  }

  // STEP C — Attempt silent token acquisition
  try {
    const token = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });

    console.log("Access token OK:", token.accessToken.substring(0, 25), "…");
    return token;

  } catch (e) {
    console.warn("Silent token failed:", e);

    if (e instanceof InteractionRequiredAuthError) {
      console.log("Silent failed — invoking acquireTokenRedirect()");
      await msalInstance.acquireTokenRedirect(loginRequest);
      return;
    }

    console.error("Unexpected MSAL error:", e);
  }
}

// Kick off MSAL login/token bootstrap
ensureLoginAndToken();

// --------------------------------------------------
// 2) After MSAL completes, React renders the UI
// --------------------------------------------------

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
