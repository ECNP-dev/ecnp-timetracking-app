
// electron/auth.js — MSAL Node + system browser + loopback
const { PublicClientApplication, LogLevel } = require("@azure/msal-node");
const { shell } = require("electron");

// TODO: fill these in from your tenant
const msalConfig = {
  auth: {
    clientId: "<YOUR_FRONTEND_CLIENT_ID>",
    authority: "https://login.microsoftonline.com/<YOUR_TENANT_ID>"
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Error
    }
  }
};

const pca = new PublicClientApplication(msalConfig);

// Scopes: your API + Graph basic profile (optional)
const scopes = [
  "api://b97f4127-1505-4284-a090-6b7472238836/access_as_user",
  "User.Read"
];

async function loginInteractive() {
  // MSAL Node will spawn system browser and a loopback listener on localhost
  const result = await pca.acquireTokenInteractive({
    scopes,
    // Using loopback is recommended for native apps (RFC 8252)
    redirectUri: "http://localhost",
    // Use system browser
    openBrowser: async (url) => {
      await shell.openExternal(url);
    }
  });
  return result; // contains account, accessToken, idToken, expiresOn
}

module.exports = { loginInteractive };
``
