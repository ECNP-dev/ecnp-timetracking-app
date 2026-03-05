import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msalConfig";

function Root() {
  // Handle MSAL redirect coming from Electron's custom protocol
  useEffect(() => {
    if (window.electronMSAL) {
      window.electronMSAL.onRedirect(async (url) => {
        try {
          const u = new URL(url);
          const hash = u.hash || "";
          await msalInstance.handleRedirectPromise(hash).then((resp) => {
            if (resp?.account) {
              msalInstance.setActiveAccount(resp.account);
            }
          });
        } catch (e) {
          console.error("MSAL redirect handling failed:", e);
        }
      });
    }

    // Also call once in case the app launched via redirect URL directly
    msalInstance
      .handleRedirectPromise()
      .then((resp) => {
        if (resp?.account) {
          msalInstance.setActiveAccount(resp.account);
        }
      })
      .catch((e) => console.warn("Initial handleRedirectPromise:", e));
  }, []);

  return (
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
