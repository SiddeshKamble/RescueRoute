import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { io } from "socket.io-client";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const socket = io("http://localhost:3000");

// Helper component to pan map to coordinates
function MapPanner({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 16, { animate: true });
  }, [position, map]);
  return null;
}

function App() {
  const [emergencies, setEmergencies] = useState([]);
  const [responders, setResponders] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const markerRefs = useRef({}); // to open popup programmatically

  // Fetch emergencies & responders
  useEffect(() => {
    fetch("http://localhost:3000/emergencies")
      .then((res) => res.json())
      .then((data) => setEmergencies(data))
      .catch(console.error);

    fetch("http://localhost:3000/responders")
      .then((res) => res.json())
      .then((data) => setResponders(data))
      .catch(console.error);
  }, []);

  // Listen for new emergencies (real-time)
  useEffect(() => {
    socket.on("new_emergency", (emergency) => {
      setEmergencies((prev) => [emergency, ...prev]);
    });
    return () => socket.off("new_emergency");
  }, []);

  // Simple geocode for demo
  const geocode = (address) => {
    const locations = {
      "123 Main St": [40.7128, -74.006],
      "456 Elm St": [40.7138, -74.001],
      "789 Oak Ave": [40.7108, -74.005],
    };
    return locations[address] || [40.7128, -74.006];
  };

  const getMarkerColor = (type) => {
    switch (type.toLowerCase()) {
      case "ambulance":
        return "blue";
      case "fire":
        return "red";
      case "police":
        return "green";
      default:
        return "gray";
    }
  };

  const createColoredIcon = (color) =>
    new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

  const getTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case "ambulance":
        return "#007bff";
      case "fire":
        return "#dc3545";
      case "police":
        return "#28a745";
      default:
        return "#6c757d";
    }
  };

  // Center map and open popup on chip click
  const handleChipClick = (id, type, location) => {
    const pos = geocode(location);
    setSelectedPosition(pos);

    // Open popup after short delay
    setTimeout(() => {
      const marker = markerRefs.current[`${type}-${id}`];
      if (marker) marker.openPopup();
    }, 300);
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "300px",
          padding: "10px",
          overflowY: "auto",
          background: "#f9f9f9",
          borderRight: "1px solid #ddd",
        }}
      >
        <h2>🚨 Emergencies</h2>
        {emergencies.length === 0 && <p>No emergencies</p>}
        {emergencies.map((e) => (
          <div
            key={e.id}
            onClick={() => handleChipClick(e.id, "emergency", e.location)}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "10px",
              padding: "8px",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "#dc3545",
                marginRight: "8px",
              }}
            ></span>
            <div>
              <strong>{e.type.toUpperCase()}</strong>
              <br />
              {e.location}
              <br />
              {new Date(e.createdAt).toLocaleString()}
            </div>
          </div>
        ))}

        <h2 style={{ marginTop: "20px" }}>👮 Responders</h2>
        {responders.length === 0 && <p>No responders</p>}
        {responders.map((r) => (
          <div
            key={r.id}
            onClick={() => handleChipClick(r.id, r.type, r.current_location)}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "10px",
              padding: "8px",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: getTypeColor(r.type),
                marginRight: "8px",
              }}
            ></span>
            <div>
              <strong>{r.name}</strong> ({r.type.toUpperCase()})
              <br />
              Status: {r.status}
              <br />
              Location: {r.current_location}
            </div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ flex: 1 }}>
        <MapContainer
          center={[40.7128, -74.006]}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          <MapPanner position={selectedPosition} />

          {emergencies.map((e) => (
            <Marker
              key={`emergency-${e.id}`}
              position={geocode(e.location)}
              icon={createColoredIcon("red")}
              ref={(ref) => (markerRefs.current[`emergency-${e.id}`] = ref)}
            >
              <Popup>
                <strong>{e.type.toUpperCase()}</strong> — {e.location}
                <br />
                {new Date(e.createdAt).toLocaleString()}
              </Popup>
            </Marker>
          ))}

          {responders.map((r) => (
            <Marker
              key={`responder-${r.id}`}
              position={geocode(r.current_location)}
              icon={createColoredIcon(getMarkerColor(r.type))}
              ref={(ref) => (markerRefs.current[`${r.type}-${r.id}`] = ref)}
            >
              <Popup>
                <strong>{r.name}</strong> — {r.type.toUpperCase()}
                <br />
                Status: {r.status}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;
