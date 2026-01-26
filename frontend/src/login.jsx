import React, { useState } from "react";

const API_BASE = "http://localhost:5050";

export default function Login({ onLogin, onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
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

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Login</h2>
        <p style={styles.sub}>Citizen or Station (Responder)</p>

        <form onSubmit={submit}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <button style={styles.primaryBtn} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <button style={styles.linkBtn} onClick={onGoRegister}>
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
    padding: 20
  },
  card: {
    width: "100%",
    maxWidth: 420,
    border: "1px solid #333",
    borderRadius: 12,
    padding: 18
  },
  sub: { marginTop: -8, opacity: 0.8 },
  label: { display: "block", marginTop: 12, marginBottom: 6, fontSize: 13, opacity: 0.9 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #444",
    outline: "none"
  },
  primaryBtn: {
    width: "100%",
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer"
  },
  linkBtn: {
    width: "100%",
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #444",
    background: "transparent",
    cursor: "pointer"
  },
  msg: { marginTop: 12, opacity: 0.9 }
};
