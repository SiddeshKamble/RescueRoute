import React, { useState } from "react";
import { geocodeAddress } from "./geocode";

const API_BASE = "http://localhost:5050";

export default function Register({ onGoLogin }) {
  const [userType, setUserType] = useState("CITIZEN");
  const [responderRole, setResponderRole] = useState("AMBULANCE");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Station address -> geocode -> coords
  const [stationAddress, setStationAddress] = useState("750 E Adams St, Syracuse NY");
  const [stationLat, setStationLat] = useState(null);
  const [stationLng, setStationLng] = useState(null);
  const [stationDisplay, setStationDisplay] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  async function locateStation() {
    setMsg("");
    setGeoLoading(true);
    try {
      const geo = await geocodeAddress(stationAddress);
      setStationLat(geo.lat);
      setStationLng(geo.lng);
      setStationDisplay(geo.displayName);
      setMsg("✅ Station address located");
    } catch (e) {
      setMsg("❌ Station address not found. Try a more complete address.");
      setStationLat(null);
      setStationLng(null);
      setStationDisplay("");
    } finally {
      setGeoLoading(false);
    }
  }

  async function handleRegister(e) {
    e?.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const body = { name, email, password, userType };

      if (userType === "RESPONDER") {
        body.responderRole = responderRole;

        // require geocoded station coords
        if (stationLat == null || stationLng == null) {
          setMsg("❌ Please click 'Auto-Locate Station' before registering.");
          setLoading(false);
          return;
        }

        body.stationLocation = { lat: stationLat, lng: stationLng };
      }

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.message || "Register failed");
        return;
      }

      setMsg("✅ Registered successfully. Now login.");
    } catch {
      setMsg("Register failed (network error)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Register</h2>
        <p style={styles.sub}>Citizen or Station account</p>

        <form onSubmit={handleRegister}>
          <label style={styles.label}>Account Type</label>
          <select
            style={styles.input}
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
          >
            <option value="CITIZEN">Citizen (creates emergencies)</option>
            <option value="RESPONDER">Responder Station (fixed location)</option>
          </select>

          <label style={styles.label}>Name</label>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} />

          <label style={styles.label}>Email</label>
          <input style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {userType === "RESPONDER" && (
            <>
              <div style={styles.hr} />

              <label style={styles.label}>Station Role</label>
              <select
                style={styles.input}
                value={responderRole}
                onChange={(e) => setResponderRole(e.target.value)}
              >
                <option value="AMBULANCE">AMBULANCE (Hospital)</option>
                <option value="FIRE">FIRE (Fire Station)</option>
                <option value="POLICE">POLICE (Police Station)</option>
              </select>

              <label style={styles.label}>Station Address</label>
              <input
                style={styles.input}
                value={stationAddress}
                onChange={(e) => setStationAddress(e.target.value)}
                placeholder="e.g., 315 W Fayette St, Syracuse NY"
              />

              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={locateStation}
                disabled={geoLoading}
              >
                {geoLoading ? "Locating..." : "Auto-Locate Station"}
              </button>

              {stationDisplay && (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                  <b>Resolved:</b> {stationDisplay}
                  <br />
                  <b>Coords:</b> {stationLat?.toFixed(5)}, {stationLng?.toFixed(5)}
                </div>
              )}
            </>
          )}

          <button style={styles.primaryBtn} disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <button style={styles.linkBtn} onClick={onGoLogin}>
          Already have an account? Login
        </button>

        {msg && <div style={styles.msg}>{msg}</div>}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 },
  card: { width: "100%", maxWidth: 520, border: "1px solid #333", borderRadius: 12, padding: 18 },
  sub: { marginTop: -8, opacity: 0.8 },
  label: { display: "block", marginTop: 12, marginBottom: 6, fontSize: 13, opacity: 0.9 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #444", outline: "none" },
  primaryBtn: { width: "100%", marginTop: 16, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer" },
  secondaryBtn: { width: "100%", marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #444", background: "transparent", cursor: "pointer" },
  linkBtn: { width: "100%", marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #444", background: "transparent", cursor: "pointer" },
  msg: { marginTop: 12, opacity: 0.9 },
  hr: { marginTop: 16, borderTop: "1px solid #333" }
};
