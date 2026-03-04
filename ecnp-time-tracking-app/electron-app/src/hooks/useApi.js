import { useMsal } from "@azure/msal-react";
import { apiConfig } from "../apiConfig";

const qs = (obj = {}) =>
  Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

export function useApi() {
  const { instance, accounts } = useMsal();

  const getAccessToken = async () => {
    const account = instance.getActiveAccount() || accounts[0];
    const result = await instance.acquireTokenSilent({
      account,
      scopes: [apiConfig.scope],
    });
    return result.accessToken;
  };

  const get = async (path, params = {}) => {
    const token = await getAccessToken();
    const url = `${apiConfig.baseUrl}${path}${
      Object.keys(params).length ? `?${qs(params)}` : ""
    }`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  };

  const post = async (path, body = {}) => {
    const token = await getAccessToken();
    const res = await fetch(`${apiConfig.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res;
  };

  const put = async (path, body = {}) => {
    const token = await getAccessToken();
    const res = await fetch(`${apiConfig.baseUrl}${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
    return res.json();
  };

  const del = async (path) => {
    const token = await getAccessToken();
    const res = await fetch(`${apiConfig.baseUrl}${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 204)
      throw new Error(`DELETE ${path} failed: ${res.status}`);
    return true;
  };

  return {
    // user endpoints
    getDailyLog: (date) => get("/daily-log", { date }),
    addEntry: ({ date, entry }) => post("/add-entry", { date, entry }),
    autoSplit: ({ date, tasks, workingMinutes }) =>
      post("/auto-split", { date, tasks, workingMinutes }),

    // admin endpoints
    listTasks: () => get("/tasks"),
    createTask: (task) => post("/tasks", task),
    updateTask: (id, updates) => put(`/tasks/${id}`),
    deleteTask: (id) => del(`/tasks/${id}`),

    downloadMonthlyReport: async (yyyyMM) => {
      const token = await getAccessToken();
      const res = await fetch(`${apiConfig.baseUrl}/admin/report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month: yyyyMM }),
      });
      if (!res.ok) throw new Error(`Report failed: ${res.status}`);
      return await res.blob();
    },
  };
}
