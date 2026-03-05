import { PublicClientApplication } from "@azure/msal-browser";
import { apiConfig } from "./apiConfig";

export const msalConfig = {
  auth: {
    clientId: "b97f4127-1505-4284-a090-6b7472238836",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: "msal://auth",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [
    "User.Read",
    "api://b97f4127-1505-4284-a090-6b7472238836/access_as_user",
  ],
};

export const msalInstance = new PublicClientApplication(msalConfig);
