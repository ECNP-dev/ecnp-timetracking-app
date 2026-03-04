import React, { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

export default function AdminTasks() {
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ Title: "", Active: true, Order: 0, Color: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listTasks(true);
      setTasks(data);
    } catch (e) {
      alert("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    await api.createTask(form);
    setForm({ Title: "", Active: true, Order: 0, Color: "" });
    load();
  };

  const update = async (id, patch) => {
    await api.updateTask(id, patch);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this task?")) return;
    await api.deleteTask(id);
    load();
  };

  return (
    <div>
      <h3>Task Catalogue</h3>
      <form
        onSubmit={create}
        style={{ display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}
      >
        <input
          placeholder="Title"
          value={form.Title}
          onChange={(e) => setForm({ ...form, Title: e.target.value })}
          required
        />
        <input
          placeholder="Order"
          type="number"
          value={form.Order}
          onChange={(e) => setForm({ ...form, Order: Number(e.target.value) })}
        />
        <input
          placeholder="Color"
          value={form.Color}
          onChange={(e) => setForm({ ...form, Color: e.target.value })}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={form.Active}
            onChange={(e) => setForm({ ...form, Active: e.target.checked })}
          />
          Active
        </label>
        <button type="submit">Add</button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Id</th>
              <th>Title</th>
              <th>Order</th>
              <th>Color</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.Id}>
                <td>{t.Id}</td>
                <td>
                  <input
                    value={t.Title}
                    onChange={(e) => update(t.Id, { Title: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={t.Order || 0}
                    onChange={(e) => update(t.Id, { Order: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    value={t.Color || ""}
                    onChange={(e) => update(t.Id, { Color: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!t.Active}
                    onChange={(e) => update(t.Id, { Active: e.target.checked })}
                  />
                </td>
                <td>
                  <button onClick={() => remove(t.Id)} style={{ color: "red" }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
