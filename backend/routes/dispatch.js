const express = require("express");
const { pool } = require("../db");
const { auth } = require("../middleware/auth");
const { allowUserTypes } = require("../middleware/role");

const router = express.Router();

// For MVP: allow RESPONDER token to view dispatch overview (later add DISPATCHER role)
router.get("/overview", auth, allowUserTypes("RESPONDER"), async (req, res) => {
  try {
    const respondersQ = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.responder_role,
         r.status,
         r.station_lat,
         r.station_lng
       FROM users u
       JOIN responders r ON r.user_id = u.id
       WHERE u.user_type='RESPONDER'
       ORDER BY u.created_at ASC`
    );

    const emergenciesQ = await pool.query(
      `SELECT
         id, created_by, type, description, lat, lng, address,
         status, assigned_responder_id, eta_seconds, distance_meters, created_at
       FROM emergencies
       WHERE status IN ('PENDING','ASSIGNED','EN_ROUTE','ON_SCENE')
       ORDER BY created_at DESC`
    );

    return res.json({
      responders: respondersQ.rows,
      emergencies: emergenciesQ.rows
    });
  } catch (err) {
    console.error("DISPATCH OVERVIEW ERROR:", err);
    return res.status(500).json({ message: "Failed to load dispatch overview", error: err.message });
  }
});

module.exports = router;
