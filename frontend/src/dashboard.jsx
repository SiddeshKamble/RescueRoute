import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { geocodeAddress } from "./geocode";
import { getResponderIcon } from "./icons";

const API_BASE = "http://localhost:5050";

const STATUS_ORDER = ["PENDING", "ASSIGNED", "EN_ROUTE", "ON_SCENE", "COMPLETED"];
const FINAL_STATUSES = ["COMPLETED", "CANCELLED"];
const ACTIVE_STATUSES = ["PENDING", "ASSIGNED", "EN_ROUTE", "ON_SCENE"];

const SAFETY = {
  AMBULANCE: {
    title: "Medical Emergency - While help is coming",
    numbers: [
      { label: "Emergency", value: "911" },
      { label: "Poison Control (US)", value: "1-800-222-1222" }
    ],
    do: [
      "Check if the person is responsive and breathing.",
      "If not breathing and you know CPR, begin CPR.",
      "If bleeding, apply firm pressure with a clean cloth.",
      "Keep the person warm and still (avoid moving if neck/back injury suspected).",
      "Gather meds/allergies and medical history if possible."
    ],
    dont: [
      "Don’t give food or drink to an unconscious person.",
      "Don’t move someone with suspected spinal injury unless in immediate danger."
    ]
  },
  FIRE: {
    title: "Fire Emergency - While help is coming",
    numbers: [{ label: "Emergency", value: "911" }],
    do: [
      "Leave the building immediately if there is smoke/fire.",
      "If safe, close doors behind you to slow fire spread.",
      "Stay low if there is smoke.",
      "Move to a safe meeting point outside."
    ],
    dont: [
      "Don’t use elevators.",
      "Don’t re-enter the building for belongings.",
      "Don’t fight large fires, wait for firefighters."
    ]
  },
  POLICE: {
    title: "Police Emergency - While help is coming",
    numbers: [{ label: "Emergency", value: "911" }],
    do: [
      "Move to a safe location if possible.",
      "If it’s safe, note details: clothing, direction of travel, vehicle plate.",
      "Keep your phone available and follow dispatcher instructions."
    ],
    dont: ["Don’t confront the suspect.", "Don’t follow someone who may be dangerous."]
  }
};

function geojsonToLatLngs(routeGeojson) {
  const coords = routeGeojson?.coordinates || [];
  return coords.map(([lng, lat]) => [lat, lng]);
}

function FitBounds({ latlngs }) {
  const map = useMap();
  useEffect(() => {
    if (!latlngs || latlngs.length < 2) return;
    map.fitBounds(latlngs, { padding: [40, 40] });
  }, [latlngs, map]);
  return null;
}

function StatusBadge({ status }) {
  const style = { ...ui.badge };
  if (status === "PENDING") style.background = "rgba(255,165,0,0.12)";
  if (status === "ASSIGNED" || status === "EN_ROUTE") style.background = "rgba(0,128,255,0.12)";
  if (status === "ON_SCENE") style.background = "rgba(0,0,0,0.06)";
  if (status === "COMPLETED") style.background = "rgba(0,200,0,0.12)";
  if (status === "CANCELLED") style.background = "rgba(255,0,0,0.10)";
  return <span style={style}>{status}</span>;
}

function StatusTracker({ status }) {
  const idx = STATUS_ORDER.indexOf(status);
  const cancelled = status === "CANCELLED";

  return (
    <div style={{ marginTop: 10 }}>
      <div style={ui.sectionTitle}>Status tracker</div>
      <div style={ui.trackerRow}>
        {STATUS_ORDER.map((s, i) => {
          const active = !cancelled && i <= idx;
          return (
            <div key={s} style={ui.trackerItem}>
              <div
                style={{
                  ...ui.dot,
                  opacity: cancelled ? 0.4 : 1,
                  background: active ? "black" : "rgba(0,0,0,0.15)"
                }}
              />
              <div style={{ fontSize: 11, opacity: active ? 0.9 : 0.55 }}>{s}</div>
              {i !== STATUS_ORDER.length - 1 && (
                <div
                  style={{
                    ...ui.line,
                    opacity: cancelled ? 0.3 : 1,
                    background: active ? "black" : "rgba(0,0,0,0.15)"
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {cancelled && (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          This request was cancelled.
        </div>
      )}
    </div>
  );
}

function SafetyPanel({ type }) {
  const info = SAFETY[type] || SAFETY.POLICE;

  return (
    <div style={ui.panel}>
      <div style={ui.panelTitle}>While you wait</div>
      <div style={ui.panelSub}>{info.title}</div>

      <div style={{ marginTop: 10 }}>
        <div style={ui.sectionTitle}>Emergency numbers</div>
        {info.numbers.map((n) => (
          <div key={n.value} style={ui.row}>
            <span style={{ opacity: 0.85 }}>{n.label}</span>
            <a href={`tel:${n.value}`} style={ui.phoneLink}>{n.value}</a>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={ui.sectionTitle}>Do</div>
        <ul style={ui.list}>
          {info.do.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={ui.sectionTitle}>Avoid</div>
        <ul style={ui.list}>
          {info.dont.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={ui.sectionTitle}>Share with responders</div>
        <ul style={ui.list}>
          <li>Exact location / nearest landmark</li>
          <li>Number of people involved</li>
          <li>Any hazards (fire, weapons, gas leak, traffic)</li>
          <li>Best entry point / access instructions</li>
        </ul>
      </div>
    </div>
  );
}

export default function Dashboard({ token, user, onLogout }) {
  const [mode, setMode] = useState("RESPONDER"); // RESPONDER | DISPATCH | CITIZEN
  const [stations, setStations] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [myEmergencies, setMyEmergencies] = useState([]);
  const [dispatchEmergencies, setDispatchEmergencies] = useState([]);
  const [selectedEmergency, setSelectedEmergency] = useState(null);

  // Citizen create emergency (address-only)
  const [type, setType] = useState("AMBULANCE");
  const [desc, setDesc] = useState("test emergency");
  const [address, setAddress] = useState("750 E Adams St, Syracuse NY");
  const [msg, setMsg] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);

  const isResponder = user?.userType === "RESPONDER";
  const isCitizen = user?.userType === "CITIZEN";

  useEffect(() => {
    if (isResponder) setMode("RESPONDER");
    if (isCitizen) setMode("CITIZEN");
  }, [isResponder, isCitizen]);

  async function loadStationsAndDispatch() {
    if (!token || !isResponder) return;
    const res = await fetch(`${API_BASE}/dispatch/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setStations(data.responders || []);
    setDispatchEmergencies(data.emergencies || []);
  }

  async function loadAssigned() {
    if (!token || !isResponder) return;
    const res = await fetch(`${API_BASE}/emergencies/assigned`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setAssigned(data.emergencies || []);
  }

  async function loadMine() {
    if (!token || !isCitizen) return;
    const res = await fetch(`${API_BASE}/emergencies/mine`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setMyEmergencies(data.emergencies || []);
  }

  useEffect(() => {
    loadStationsAndDispatch().catch(() => {});
    loadAssigned().catch(() => {});
    loadMine().catch(() => {});
    // eslint-disable-next-line
  }, []);

  async function createEmergency() {
    setMsg("");
    setGeoLoading(true);

    try {
      const geo = await geocodeAddress(address);

      const body = {
        type,
        description: desc,
        location: {
          lat: geo.lat,
          lng: geo.lng,
          address: geo.displayName
        }
      };

      const res = await fetch(`${API_BASE}/emergencies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.message || "Failed to create emergency");
        return;
      }

      setMsg("✅ Emergency created");
      await loadMine();
    } catch (err) {
      setMsg("❌ Address not found. Try a more complete address.");
    } finally {
      setGeoLoading(false);
    }
  }

  async function cancelEmergency(emergencyId) {
    setMsg("");
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.message || "Cancel failed");
      return;
    }
    setMsg("✅ Emergency cancelled");
    await loadMine();
    setSelectedEmergency(null);
  }

  async function updateEmergencyStatus(emergencyId, newStatus) {
    setMsg("");
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.message || "Status update failed");
      return;
    }
    setMsg(`✅ Status updated to ${newStatus}`);
    await loadAssigned();
    await loadStationsAndDispatch();
  }

  const routeLatLngs = useMemo(() => {
    if (!selectedEmergency?.route_geojson) return null;
    const pts = geojsonToLatLngs(selectedEmergency.route_geojson);
    return pts.length >= 2 ? pts : null;
  }, [selectedEmergency]);

  const mapCenter = useMemo(() => {
    if (routeLatLngs?.length) return routeLatLngs[0];
    const s = stations.find(x => x.station_lat != null && x.station_lng != null);
    if (s) return [Number(s.station_lat), Number(s.station_lng)];
    const list = isCitizen ? myEmergencies : assigned;
    const e = list.find(x => x.lat != null && x.lng != null);
    if (e) return [Number(e.lat), Number(e.lng)];
    return [43.0481, -76.1474];
  }, [routeLatLngs, stations, myEmergencies, assigned, isCitizen]);

  const myStation = useMemo(() => {
    if (!isResponder) return null;
    return stations.find(s => s.id === user.id) || null;
  }, [stations, isResponder, user]);

  const listForMap =
    isResponder && mode === "DISPATCH"
      ? dispatchEmergencies
      : isResponder
      ? assigned
      : myEmergencies;

  function formatEta(e) {
    if (e?.eta_seconds == null || e?.distance_meters == null) return "";
    const mins = Math.round(e.eta_seconds / 60);
    const km = (e.distance_meters / 1000).toFixed(2);
    return `ETA: ${mins} min • ${km} km`;
  }

  function canCancel(e) {
    return isCitizen && e && e.created_by === user.id && ACTIVE_STATUSES.includes(e.status);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", height: "100vh" }}>
      {/* Sidebar */}
      <div style={{ padding: 16, borderRight: "1px solid rgba(0,0,0,0.12)", overflow: "auto" }}>
        <div style={ui.headerRow}>
          <div>
            <h2 style={{ margin: 0 }}>RescueRoute</h2>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              {user.userType} {user.responderRole ? `(${user.responderRole})` : ""}
            </div>
          </div>
          <button style={ui.btnOutline} onClick={onLogout}>Logout</button>
        </div>

        {msg && <div style={ui.toast}>{msg}</div>}

        {/* Responder toggle */}
        {isResponder && (
          <>
            <div style={ui.card}>
              <div style={ui.sectionTitle}>View</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  style={mode === "RESPONDER" ? ui.btnPrimary : ui.btnOutline}
                  onClick={() => { setMode("RESPONDER"); setSelectedEmergency(null); }}
                >
                  Station
                </button>
                <button
                  style={mode === "DISPATCH" ? ui.btnPrimary : ui.btnOutline}
                  onClick={() => { setMode("DISPATCH"); setSelectedEmergency(null); }}
                >
                  Dispatch
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                🔴 FIRE • 🟢 AMBULANCE • 🔵 POLICE
              </div>
            </div>
          </>
        )}

        {/* Citizen create */}
        {isCitizen && (
          <div style={ui.card}>
            <div style={ui.sectionTitle}>Create Emergency (Address)</div>

            <label style={ui.label}>Type</label>
            <select style={ui.input} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="AMBULANCE">AMBULANCE</option>
              <option value="FIRE">FIRE</option>
              <option value="POLICE">POLICE</option>
            </select>

            <label style={ui.label}>Description</label>
            <input style={ui.input} value={desc} onChange={(e) => setDesc(e.target.value)} />

            <label style={ui.label}>Emergency Address</label>
            <input
              style={ui.input}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 750 E Adams St, Syracuse NY"
            />

            <button style={ui.btnPrimary} onClick={createEmergency} disabled={geoLoading}>
              {geoLoading ? "Locating address..." : "Submit Emergency"}
            </button>

            <SafetyPanel type={type} />
          </div>
        )}

        {/* Lists */}
        {isResponder && mode === "RESPONDER" && (
          <div style={ui.card}>
            <div style={ui.sectionTitle}>Assigned Emergencies</div>
            {assigned.length === 0 ? (
              <div style={{ opacity: 0.75, marginTop: 8 }}>No assigned emergencies</div>
            ) : (
              assigned.map((e) => (
                <div
                  key={e.id}
                  style={{
                    ...ui.listItem,
                    borderColor: selectedEmergency?.id === e.id ? "black" : "rgba(0,0,0,0.10)"
                  }}
                  onClick={() => setSelectedEmergency(e)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div><b>{e.type}</b></div>
                    <StatusBadge status={e.status} />
                  </div>
                  <div style={ui.small}>{e.address || "—"}</div>
                  <div style={ui.small}>{formatEta(e)}</div>
                </div>
              ))
            )}
            <button style={ui.btnOutline} onClick={loadAssigned}>Refresh</button>
          </div>
        )}

        {isResponder && mode === "DISPATCH" && (
          <div style={ui.card}>
            <div style={ui.sectionTitle}>Dispatch Overview</div>
            <div style={ui.small}>Stations: {stations.length} • Active: {dispatchEmergencies.length}</div>

            <div style={{ marginTop: 10 }}>
              {dispatchEmergencies.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No active emergencies</div>
              ) : (
                dispatchEmergencies.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      ...ui.listItem,
                      borderColor: selectedEmergency?.id === e.id ? "black" : "rgba(0,0,0,0.10)"
                    }}
                    onClick={() => setSelectedEmergency(e)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div><b>{e.type}</b></div>
                      <StatusBadge status={e.status} />
                    </div>
                    <div style={ui.small}>{e.address || "—"}</div>
                  </div>
                ))
              )}
            </div>

            <button style={ui.btnOutline} onClick={loadStationsAndDispatch}>Refresh</button>
          </div>
        )}

        {isCitizen && (
          <div style={ui.card}>
            <div style={ui.sectionTitle}>My Emergencies</div>
            {myEmergencies.length === 0 ? (
              <div style={{ opacity: 0.75, marginTop: 8 }}>No emergencies yet</div>
            ) : (
              myEmergencies.map((e) => (
                <div
                  key={e.id}
                  style={{
                    ...ui.listItem,
                    borderColor: selectedEmergency?.id === e.id ? "black" : "rgba(0,0,0,0.10)"
                  }}
                  onClick={() => setSelectedEmergency(e)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div><b>{e.type}</b></div>
                    <StatusBadge status={e.status} />
                  </div>
                  <div style={ui.small}>{e.address || "—"}</div>
                  <div style={ui.small}>{formatEta(e)}</div>

                  {ACTIVE_STATUSES.includes(e.status) && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        style={ui.btnDanger}
                        onClick={(ev) => { ev.stopPropagation(); cancelEmergency(e.id); }}
                      >
                        Cancel request
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <button style={ui.btnOutline} onClick={loadMine}>Refresh</button>
          </div>
        )}

        {/* Selected panel (actions + tracker) */}
        {selectedEmergency && (
          <div style={ui.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800 }}>{selectedEmergency.type}</div>
                <div style={ui.small}>{selectedEmergency.address || "—"}</div>
              </div>
              <StatusBadge status={selectedEmergency.status} />
            </div>

            <StatusTracker status={selectedEmergency.status} />

            {/* Citizen actions */}
            {isCitizen && canCancel(selectedEmergency) && (
              <button
                style={{ ...ui.btnDanger, marginTop: 12 }}
                onClick={() => cancelEmergency(selectedEmergency.id)}
              >
                Cancel request
              </button>
            )}

            {/* Responder actions */}
            {isResponder && !FINAL_STATUSES.includes(selectedEmergency.status) && selectedEmergency.assigned_responder_id === user.id && (
              <>
                <div style={{ marginTop: 12, ...ui.sectionTitle }}>Responder actions</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    style={ui.btnOutline}
                    onClick={() => updateEmergencyStatus(selectedEmergency.id, "EN_ROUTE")}
                  >
                    Mark EN_ROUTE
                  </button>
                  <button
                    style={ui.btnOutline}
                    onClick={() => updateEmergencyStatus(selectedEmergency.id, "ON_SCENE")}
                  >
                    Mark ON_SCENE
                  </button>
                  <button
                    style={ui.btnPrimary}
                    onClick={() => updateEmergencyStatus(selectedEmergency.id, "COMPLETED")}
                  >
                    Complete
                  </button>
                </div>
              </>
            )}

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Click route on map by selecting an emergency.
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ height: "100%", width: "100%" }}>
        <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Permanent station markers */}
          {stations
            .filter(s => s.station_lat != null && s.station_lng != null)
            .map((s) => (
              <Marker
                key={s.id}
                position={[Number(s.station_lat), Number(s.station_lng)]}
                icon={getResponderIcon(s.responder_role)}
              >
                <Popup>
                  <b>{s.name}</b><br />
                  {s.responder_role}<br />
                  Status: {s.status}
                  {myStation?.id === s.id ? <><br /><b>(My Station)</b></> : null}
                </Popup>
              </Marker>
            ))}

          {/* Emergency markers */}
          {listForMap
            .filter(e => e.lat != null && e.lng != null)
            .map((e) => (
              <Marker key={e.id} position={[Number(e.lat), Number(e.lng)]}>
                <Popup>
                  <b>{e.type}</b><br />
                  {e.status}<br />
                  {e.address || ""}
                </Popup>
              </Marker>
            ))}

          {/* Selected route */}
          {selectedEmergency?.route_geojson && (
            (() => {
              const pts = geojsonToLatLngs(selectedEmergency.route_geojson);
              if (pts.length < 2) return null;
              return (
                <>
                  <Polyline positions={pts} />
                  <FitBounds latlngs={pts} />
                </>
              );
            })()
          )}
        </MapContainer>
      </div>
    </div>
  );
}

const ui = {
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)"
  },
  sectionTitle: { fontWeight: 800, fontSize: 13, opacity: 0.9 },
  label: { display: "block", marginTop: 10, marginBottom: 6, fontSize: 12, opacity: 0.8 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    outline: "none"
  },
  btnPrimary: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    background: "black",
    color: "white",
    fontWeight: 700
  },
  btnOutline: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 700
  },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,0,0,0.30)",
    background: "rgba(255,0,0,0.08)",
    cursor: "pointer",
    fontWeight: 800
  },
  listItem: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "white",
    marginTop: 10
  },
  small: { fontSize: 12, opacity: 0.75, marginTop: 4 },
  badge: {
    fontSize: 11,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.05)",
    fontWeight: 800,
    whiteSpace: "nowrap"
  },
  toast: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontSize: 13
  },
  panel: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white"
  },
  panelTitle: { fontWeight: 900, fontSize: 14 },
  panelSub: { marginTop: 4, fontSize: 12, opacity: 0.75 },
  row: { display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13 },
  phoneLink: { textDecoration: "none", fontWeight: 900 },
  list: { margin: "6px 0 0 18px", padding: 0, fontSize: 13, lineHeight: 1.35 },

  trackerRow: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, alignItems: "center" },
  trackerItem: { position: "relative", display: "flex", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  line: { width: 26, height: 2, borderRadius: 2 }
};
