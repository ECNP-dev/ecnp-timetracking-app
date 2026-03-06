
// src/index.jsx — FINAL MSAL REDIRECT HANDLER

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

import { msalInstance, loginRequest } from "./msalConfig";

async function initializeAuth() {

  // Renderer ready → notify main
  window.electronMSAL.notifyReady?.();

  await msalInstance.initialize();

  // Listen for redirect URIs from main process
  window.electronMSAL.onRedirect?.( async (uri) => {
    console.log("Handling redirect from main:", uri);
    await msalInstance.handleRedirectPromise(uri);
  });

  // Restore cached user
  const cached =
    msalInstance.getActiveAccount() ||
    msalInstance.getAllAccounts()[0];

  if (cached) msalInstance.setActiveAccount(cached);
}

// Initialize MSAL BEFORE UI
initializeAuth().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
