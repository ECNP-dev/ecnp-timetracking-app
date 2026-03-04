import React, { useMemo, useState } from "react";

export default function AutoSplitModal({
  isOpen,
  onClose,
  allTasks,
  defaultWorkingMinutes = 480,
  minutesAlreadyLogged = 0,
  isDayOff = false,
  onApply, // (selectedTasks, minutesToDistribute)
}) {
  const [selected, setSelected] = useState([]);
  const [workingMinutes, setWorkingMinutes] = useState(defaultWorkingMinutes);

  const remainingMinutes = Math.max(
    0,
    (workingMinutes || 0) - (minutesAlreadyLogged || 0)
  );

  const preview = useMemo(() => {
    if (selected.length === 0 || remainingMinutes === 0) return [];
    const base = Math.floor(remainingMinutes / selected.length);
    const remainder = remainingMinutes % selected.length;
    return selected.map((task, idx) => ({
      task,
      minutes: base + (idx === selected.length - 1 ? remainder : 0),
    }));
  }, [selected, remainingMinutes]);

  const toggleTask = (task) => {
    setSelected((prev) =>
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    );
  };

  if (!isOpen) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <h3>Divide day evenly across tasks</h3>

        {isDayOff && (
          <div style={styles.banner}>
            Outlook shows a day off. You can still proceed (override).
          </div>
        )}

        <label style={{ display: "block", marginTop: 8 }}>Select tasks:</label>
        <div style={styles.tasksBox}>
          {allTasks.map((t) => (
            <label key={t} style={styles.checkbox}>
              <input
                type="checkbox"
                checked={selected.includes(t)}
                onChange={() => toggleTask(t)}
              />
              <span style={{ marginLeft: 8 }}>{t}</span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label>Total working minutes</label>
            <input
              type="number"
              min={0}
              value={workingMinutes}
              onChange={(e) =>
                setWorkingMinutes(parseInt(e.target.value || 0, 10))
              }
              style={styles.input}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Already logged</label>
            <input
              type="number"
              value={minutesAlreadyLogged}
              readOnly
              style={styles.input}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>To distribute</label>
            <input type="number" value={remainingMinutes} readOnly style={styles.input} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>Preview</strong>
          {preview.length === 0 ? (
            <p style={{ color: "#666" }}>Select tasks to see the split.</p>
          ) : (
            <ul>
              {preview.map((p) => (
                <li key={p.task}>
                  {p.task}: {p.minutes} min
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 8,
          }}
        >
          <button onClick={onClose} style={styles.btnGhost}>
            Cancel
          </button>
          <button
            onClick={() => onApply(selected, remainingMinutes)}
            disabled={selected.length === 0 || remainingMinutes === 0}
            style={styles.btnPrimary}
          >
            Apply split
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 50,
  },
  modal: {
    maxWidth: 560,
    width: "100%",
    background: "#fff",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  },
  tasksBox: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 8,
    border: "1px solid #e1e4e8",
    borderRadius: 8,
    padding: 8,
    maxHeight: 180,
    overflow: "auto",
  },
  checkbox: { display: "flex", alignItems: "center", padding: "6px 4px" },
  input: { width: "100%", padding: 8, border: "1px solid #d0d7de", borderRadius: 6 },
  btnGhost: {
    padding: "10px 14px",
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  },
  btnPrimary: {
    padding: "10px 14px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
  },
  banner: {
    background: "#fef3c7",
    border: "1px solid #fde68a",
    color: "#78350f",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
};
