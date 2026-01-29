const express = require("express");
const { v4: uuid } = require("uuid");
const { pool } = require("../db");
const { auth } = require("../middleware/auth");
const { allowUserTypes } = require("../middleware/role");

const router = express.Router();

const VALID_TYPES = ["AMBULANCE", "POLICE", "FIRE"];
const ACTIVE_STATUSES = ["PENDING", "ASSIGNED", "EN_ROUTE", "ON_SCENE"];
const FINAL_STATUSES = ["COMPLETED", "CANCELLED"];

// Haversine distance in meters
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// OSRM route (free public endpoint)
async function getOsrmRoute(stLat, stLng, emLat, emLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${stLng},${stLat};${emLng},${emLat}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`OSRM failed: ${r.status}`);
  const data = await r.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("OSRM returned no route");
  return {
    geometry: route.geometry,
    duration: Math.round(route.duration),
    distance: Math.round(route.distance)
  };
}

async function pickNearestStation(type, emLat, emLng) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.responder_role, r.station_lat, r.station_lng
     FROM users u
     JOIN responders r ON r.user_id = u.id
     WHERE u.user_type='RESPONDER'
       AND u.responder_role=$1
       AND r.status='AVAILABLE'`,
    [type]
  );

  let best = null;
  let bestD = Infinity;
  for (const s of rows) {
    const d = haversineMeters(emLat, emLng, Number(s.station_lat), Number(s.station_lng));
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * POST /emergencies
 * Citizen creates emergency -> assign nearest available station -> store route
 */
router.post("/", auth, allowUserTypes("CITIZEN"), async (req, res) => {
  const { type, description, location } = req.body;

  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be ${VALID_TYPES.join(", ")}` });
  }
  if (!location || typeof location !== "object") {
    return res.status(400).json({ message: "location object required {lat,lng,address}" });
  }

  const emLat = Number(location.lat);
  const emLng = Number(location.lng);
  const address = location.address || null;

  if (!Number.isFinite(emLat) || !Number.isFinite(emLng)) {
    return res.status(400).json({ message: "location.lat and location.lng must be numbers" });
  }

  const emergencyId = uuid();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const station = await pickNearestStation(type, emLat, emLng);

    let status = "PENDING";
    let assignedResponderId = null;
    let routeGeojson = null;
    let etaSeconds = null;
    let distanceMeters = null;

    if (station) {
      const route = await getOsrmRoute(
        Number(station.station_lat),
        Number(station.station_lng),
        emLat,
        emLng
      );

      status = "ASSIGNED";
      assignedResponderId = station.id;
      routeGeojson = route.geometry;
      etaSeconds = route.duration;
      distanceMeters = route.distance;

      await client.query(`UPDATE responders SET status='BUSY' WHERE user_id=$1`, [assignedResponderId]);
    }

    await client.query(
      `INSERT INTO emergencies
       (id, created_by, type, description, lat, lng, address, status, assigned_responder_id, route_geojson, eta_seconds, distance_meters)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        emergencyId,
        req.user.id,
        type,
        description || "",
        emLat,
        emLng,
        address,
        status,
        assignedResponderId,
        routeGeojson,
        etaSeconds,
        distanceMeters
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      id: emergencyId,
      created_by: req.user.id,
      type,
      description: description || "",
      lat: emLat,
      lng: emLng,
      address,
      status,
      assigned_responder_id: assignedResponderId,
      route_geojson: routeGeojson,
      eta_seconds: etaSeconds,
      distance_meters: distanceMeters
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE EMERGENCY ERROR:", err);
    return res.status(500).json({ message: "Failed to create emergency", error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /emergencies/mine (Citizen)
 */
router.get("/mine", auth, allowUserTypes("CITIZEN"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, created_by, type, description, lat, lng, address, status,
              assigned_responder_id, route_geojson, eta_seconds, distance_meters, created_at
       FROM emergencies
       WHERE created_by = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ emergencies: rows });
  } catch (err) {
    console.error("MINE ERROR:", err);
    return res.status(500).json({ message: "Failed to load emergencies", error: err.message });
  }
});

/**
 * GET /emergencies/assigned (Responder station)
 */
router.get("/assigned", auth, allowUserTypes("RESPONDER"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, created_by, type, description, lat, lng, address, status,
              assigned_responder_id, route_geojson, eta_seconds, distance_meters, created_at
       FROM emergencies
       WHERE assigned_responder_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ emergencies: rows });
  } catch (err) {
    console.error("ASSIGNED ERROR:", err);
    return res.status(500).json({ message: "Failed to load assigned emergencies", error: err.message });
  }
});

/**
 * PATCH /emergencies/:id/cancel  (Citizen)
 * Cancels if emergency belongs to citizen and is not completed/cancelled.
 * If it was assigned -> frees the station (AVAILABLE).
 */
router.patch("/:id/cancel", auth, allowUserTypes("CITIZEN"), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, created_by, status, assigned_responder_id
       FROM emergencies
       WHERE id=$1
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Emergency not found" });
    }

    const e = rows[0];

    if (e.created_by !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Not your emergency" });
    }

    if (FINAL_STATUSES.includes(e.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Cannot cancel. Status is ${e.status}` });
    }

    const upd = await client.query(
      `UPDATE emergencies
       SET status='CANCELLED'
       WHERE id=$1
       RETURNING id, created_by, type, description, lat, lng, address, status,
                 assigned_responder_id, route_geojson, eta_seconds, distance_meters, created_at`,
      [id]
    );

    // free station if assigned
    if (e.assigned_responder_id) {
      await client.query(
        `UPDATE responders SET status='AVAILABLE' WHERE user_id=$1`,
        [e.assigned_responder_id]
      );
    }

    await client.query("COMMIT");
    return res.json({ emergency: upd.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CANCEL ERROR:", err);
    return res.status(500).json({ message: "Failed to cancel emergency", error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PATCH /emergencies/:id/status (Responder station)
 * Allowed: EN_ROUTE, ON_SCENE, COMPLETED
 * Only assigned station can update. COMPLETED frees station.
 */
router.patch("/:id/status", auth, allowUserTypes("RESPONDER"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ["EN_ROUTE", "ON_SCENE", "COMPLETED"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: `status must be ${allowed.join(", ")}` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, status, assigned_responder_id
       FROM emergencies
       WHERE id=$1
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Emergency not found" });
    }

    const e = rows[0];

    if (e.assigned_responder_id !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Not assigned to you" });
    }

    if (FINAL_STATUSES.includes(e.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Cannot update. Status is ${e.status}` });
    }

    const upd = await client.query(
      `UPDATE emergencies
       SET status=$1
       WHERE id=$2
       RETURNING id, created_by, type, description, lat, lng, address, status,
                 assigned_responder_id, route_geojson, eta_seconds, distance_meters, created_at`,
      [status, id]
    );

    if (status === "COMPLETED") {
      await client.query(`UPDATE responders SET status='AVAILABLE' WHERE user_id=$1`, [req.user.id]);
    }

    await client.query("COMMIT");
    return res.json({ emergency: upd.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("STATUS UPDATE ERROR:", err);
    return res.status(500).json({ message: "Failed to update status", error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
