import React, { useState } from "react";

const API_BASE = "http://localhost:5050";

// ✅ CHANGE THESE if your demo accounts differ
const DEMO_USERS = {
  CITIZEN: { label: "Demo Citizen", email: "citizen@test.com", password: "pass123" },
  AMBULANCE: { label: "Demo Ambulance Station", email: "hospital@test.com", password: "pass123" },
  FIRE: { label: "Demo Fire Station", email: "fire@test.com", password: "pass123" },
  POLICE: { label: "Demo Police Station", email: "police@test.com", password: "pass123" }
};

export default function Login({ onLogin, onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e, override) {
    e?.preventDefault();
    setMsg("");
    setLoading(true);

    const useEmail = override?.email ?? email;
    const usePassword = override?.password ?? password;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: useEmail, password: usePassword })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.message || "Login failed");
        return;
      }

      onLogin(data.token, data.user);
    } catch {
      setMsg("Login failed (network error)");
    } finally {
      setLoading(false);
    }
  }

  function demoLogin(key) {
    const d = DEMO_USERS[key];
    setEmail(d.email);
    setPassword(d.password);
    submit(null, d);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Login</h1>
            <div style={styles.sub}>Citizen or Station (Responder)</div>
          </div>
          <div style={styles.badge}>RescueRoute</div>
        </div>

        <form onSubmit={submit} style={{ marginTop: 14 }}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            autoComplete="username"
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          <button style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div style={styles.dividerRow}>
          <div style={styles.divider} />
          <span style={styles.dividerText}>Demo logins</span>
          <div style={styles.divider} />
        </div>

        <div style={styles.demoGrid}>
          <button style={styles.demoBtn} onClick={() => demoLogin("CITIZEN")} type="button">
            👤 {DEMO_USERS.CITIZEN.label}
          </button>
          <button style={styles.demoBtn} onClick={() => demoLogin("AMBULANCE")} type="button">
            🟢 {DEMO_USERS.AMBULANCE.label}
          </button>
          <button style={styles.demoBtn} onClick={() => demoLogin("FIRE")} type="button">
            🔴 {DEMO_USERS.FIRE.label}
          </button>
          <button style={styles.demoBtn} onClick={() => demoLogin("POLICE")} type="button">
            🔵 {DEMO_USERS.POLICE.label}
          </button>
        </div>

        <button style={styles.linkBtn} onClick={onGoRegister} type="button">
          New here? Register
        </button>

        {msg && <div style={styles.msg}>{msg}</div>}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 22,
    background:
      "radial-gradient(1200px 500px at 50% -10%, rgba(0,0,0,0.06), transparent), #fafafa",
    boxSizing: "border-box"
  },
  card: {
    width: "100%",
    maxWidth: 560,
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    boxSizing: "border-box",
    overflow: "hidden" // ✅ prevents any accidental spill
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10
  },
  title: { margin: 0, fontSize: 30, letterSpacing: -0.3 },
  sub: { marginTop: 4, opacity: 0.75 },
  badge: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.03)"
  },
  label: { display: "block", marginTop: 12, marginBottom: 6, fontSize: 13, opacity: 0.85 },
  input: {
    width: "100%",
    boxSizing: "border-box", // ✅ key fix
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    background: "#fff",
    fontSize: 14
  },
  primaryBtn: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: 14,
    padding: "12px 12px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    background: "black",
    color: "white",
    fontWeight: 600
  },
  dividerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 12
  },
  divider: { flex: 1, height: 1, background: "rgba(0,0,0,0.10)" },
  dividerText: { fontSize: 12, opacity: 0.7 },
  demoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10
  },
  demoBtn: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.02)",
    cursor: "pointer",
    fontWeight: 600
  },
  linkBtn: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: 12,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 600
  },
  msg: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)"
  }
};
