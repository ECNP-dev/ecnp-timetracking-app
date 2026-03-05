# ECNP Time Tracker (Electron + React + Azure Functions + SharePoint)

A lightweight **desktop time‑tracking app** for ECNP with:

- ✅ **Microsoft sign‑in (MSAL)** — org accounts only  
- ✅ **Electron** floating, always‑on‑top window with tray controls  
- ✅ **Tasks centrally managed by Admin** (CRUD)  
- ✅ **Daily logs** saved in **SharePoint** (WorkLog list)  
- ✅ **Auto‑split**: divide today’s remaining working minutes evenly across selected tasks  
- ✅ **Monthly Excel report** (Summary + Daily Detail) **auto‑saved** to SharePoint folder  
- ✅ **Free to host** (Azure Functions Consumption plan + your M365 SharePoint)

---

## Contents

- Architecture
- Prerequisites
- Project Structure
- Configuration
- Local Development
- Build Desktop Installer
- Azure Deployment (Free Tier)
- SharePoint Setup
- Admin Features
- Security Notes
- Troubleshooting
- FAQ
- License

---

## Architecture

```
Electron (desktop) ─ MSAL → Microsoft Entra ID
    │
    ├── calls → Azure Functions API (Bearer token)
    │                 │
    │                 └── SharePoint Site (Lists + Document Library)
    │                       • WorkLog (daily logs)
    │                       • TasksCatalog (admin‑managed tasks)
    │                       • Monthly reports stored under:
    │                         Shared Documents/General/ICT/Timetracking
    │
    └── UI:
         • Start/Stop tracking
         • Auto‑split remaining minutes
         • Admin tasks & monthly export
```

---

## Prerequisites

- Node.js LTS (18+)
- Git
- Azure Functions Core Tools v4
- .NET 6 runtime
- Microsoft 365 tenant with SharePoint Online
- Azure AD App Registration
  - Client ID: `b97f4127-1505-4284-a090-6b7472238836`
  - API Scope: `api://b97f4127-1505-4284-a090-6b7472238836/access_as_user`

Admin account: `secretariat@ecnp.eu`

---

## Project Structure

See project tree in previous message.

---

## Configuration

### Electron + React
Create `.env` inside `electron-app/`:
```
VITE_API_BASE_URL=http://localhost:7071/api
VITE_API_SCOPE=api://b97f4127-1505-4284-a090-6b7472238836/access_as_user
```

### Azure Functions
Copy/localize config for SharePoint.

---

## Local Development

### Backend
```
cd functions-api
npm install
func start
```

### Frontend
```
cd electron-app
npm install
npm run dev
```

---

## Build Desktop Installer
```
npm run dist
```
The installer appears in `electron-app/dist/`.

---

## Azure Deployment (Free Tier)

Use Azure Functions Consumption plan + EasyAuth.

---

## SharePoint Setup

Site: `https://ecnp.sharepoint.com/sites/Office`
Lists auto‑created:
- WorkLog
- TasksCatalog

Reports saved to:
`Shared Documents/General/ICT/Timetracking`

---

## Admin Features

Admin = `secretariat@ecnp.eu`
- Manage Tasks
- Generate Monthly Reports

---

## Security Notes

- MSAL custom protocol: `msal://auth`
- Tokens acquired silently
- EasyAuth used for identity

---

## Troubleshooting

See section in previous message.

---

## License
Internal ECNP use only.
