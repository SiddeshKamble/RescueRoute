import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { geocodeAddress } from "./geocode";
import { getResponderIcon } from "./icons";

const API_BASE = "http://localhost:5050";

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
      setSelectedEmergency(null);
    } catch (err) {
      setMsg("❌ Address not found. Try a more complete address.");
    } finally {
      setGeoLoading(false);
    }
  }

  // ✅ Citizen cancels emergency
  async function cancelEmergency(id) {
    setMsg("");
    const res = await fetch(`${API_BASE}/emergencies/${id}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.message || "Cancel failed");
      return;
    }
    setMsg("✅ Request cancelled");
    await loadMine();
    setSelectedEmergency(data.emergency);
  }

  // ✅ Responder updates status
  async function updateStatus(id, status) {
    const res = await fetch(`${API_BASE}/emergencies/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.message || "Status update failed");
      return;
    }
    await loadAssigned();
    await loadStationsAndDispatch();
    setSelectedEmergency(data.emergency);
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

  const canCitizenCancel =
    isCitizen &&
    selectedEmergency &&
    ["PENDING", "ASSIGNED"].includes(selectedEmergency.status);

  const canResponderUpdate =
    isResponder &&
    selectedEmergency &&
    ["ASSIGNED", "EN_ROUTE", "ON_SCENE"].includes(selectedEmergency.status);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", height: "100vh" }}>
      {/* Sidebar */}
      <div style={{ padding: 16, borderRight: "1px solid #333", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>RescueRoute</h2>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {user.userType} {user.responderRole ? `(${user.responderRole})` : ""}
            </div>
          </div>
          <button onClick={onLogout}>Logout</button>
        </div>

        {msg && <div style={{ marginTop: 10 }}>{msg}</div>}

        {/* Mode toggle */}
        {isResponder && (
          <div style={{ marginTop: 12 }}>
            <b>View:</b>{" "}
            <button onClick={() => { setMode("RESPONDER"); setSelectedEmergency(null); }}>
              Station
            </button>
            <button onClick={() => { setMode("DISPATCH"); setSelectedEmergency(null); }} style={{ marginLeft: 8 }}>
              Dispatch
            </button>
          </div>
        )}

        {/* Citizen create */}
        {isCitizen && (
          <>
            <h3 style={{ marginTop: 16 }}>Create Emergency (Address)</h3>

            <label>Type</label><br />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="AMBULANCE">AMBULANCE</option>
              <option value="FIRE">FIRE</option>
              <option value="POLICE">POLICE</option>
            </select>

            <div style={{ height: 8 }} />
            <label>Description</label><br />
            <input value={desc} onChange={(e) => setDesc(e.target.value)} style={{ width: "100%" }} />

            <div style={{ height: 8 }} />
            <label>Emergency Address</label><br />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ width: "100%" }}
              placeholder="e.g., 147 Cambridge Street, Syracuse NY"
            />

            <div style={{ height: 12 }} />
            <button onClick={createEmergency} disabled={geoLoading}>
              {geoLoading ? "Locating address..." : "Submit Emergency"}
            </button>
          </>
        )}

        {/* Lists */}
        {isResponder && mode === "RESPONDER" && (
          <>
            <h3 style={{ marginTop: 16 }}>Assigned Emergencies</h3>
            {assigned.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No assigned emergencies</div>
            ) : (
              assigned.map((e) => (
                <div
                  key={e.id}
                  style={{ padding: "10px 0", borderBottom: "1px solid #333", cursor: "pointer" }}
                  onClick={() => setSelectedEmergency(e)}
                >
                  <div><b>{e.type}</b> — {e.status}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{e.address || "—"}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{formatEta(e)}</div>
                </div>
              ))
            )}
            <button style={{ marginTop: 10 }} onClick={loadAssigned}>Refresh</button>
          </>
        )}

        {isResponder && mode === "DISPATCH" && (
          <>
            <h3 style={{ marginTop: 16 }}>Dispatch Overview</h3>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Stations: {stations.length} • Active emergencies: {dispatchEmergencies.length}
            </div>

            <h4 style={{ marginTop: 12 }}>Active Emergencies</h4>
            {dispatchEmergencies.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No active emergencies</div>
            ) : (
              dispatchEmergencies.map((e) => (
                <div
                  key={e.id}
                  style={{ padding: "10px 0", borderBottom: "1px solid #333", cursor: "pointer" }}
                  onClick={() => setSelectedEmergency(e)}
                >
                  <div><b>{e.type}</b> — {e.status}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{e.address || "—"}</div>
                </div>
              ))
            )}

            <button style={{ marginTop: 10 }} onClick={loadStationsAndDispatch}>Refresh</button>
          </>
        )}

        {isCitizen && (
          <>
            <h3 style={{ marginTop: 16 }}>My Emergencies</h3>
            {myEmergencies.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No emergencies yet</div>
            ) : (
              myEmergencies.map((e) => (
                <div
                  key={e.id}
                  style={{ padding: "10px 0", borderBottom: "1px solid #333", cursor: "pointer" }}
                  onClick={() => setSelectedEmergency(e)}
                >
                  <div><b>{e.type}</b> — {e.status}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{e.address || "—"}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{formatEta(e)}</div>
                </div>
              ))
            )}
            <button style={{ marginTop: 10 }} onClick={loadMine}>Refresh</button>
          </>
        )}

        {/* Action buttons for selected emergency */}
        {selectedEmergency && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #333" }}>
            <div><b>Selected:</b> {selectedEmergency.type} — {selectedEmergency.status}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{selectedEmergency.address || ""}</div>

            {isCitizen && (
              <div style={{ marginTop: 10 }}>
                <button
                  disabled={!canCitizenCancel}
                  onClick={() => cancelEmergency(selectedEmergency.id)}
                >
                  Cancel Request
                </button>
                {!canCitizenCancel && (
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                    You can cancel only when status is PENDING or ASSIGNED.
                  </div>
                )}
              </div>
            )}

            {isResponder && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled={!canResponderUpdate} onClick={() => updateStatus(selectedEmergency.id, "EN_ROUTE")}>
                  EN_ROUTE
                </button>
                <button disabled={!canResponderUpdate} onClick={() => updateStatus(selectedEmergency.id, "ON_SCENE")}>
                  ON_SCENE
                </button>
                <button disabled={!canResponderUpdate} onClick={() => updateStatus(selectedEmergency.id, "COMPLETED")}>
                  COMPLETED
                </button>
              </div>
            )}
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
          {routeLatLngs && (
            <>
              <Polyline positions={routeLatLngs} />
              <FitBounds latlngs={routeLatLngs} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
