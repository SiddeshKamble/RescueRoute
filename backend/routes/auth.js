const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");

const { pool } = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const USER_TYPES = ["CITIZEN", "RESPONDER"];
const RESPONDER_ROLES = ["AMBULANCE", "POLICE", "FIRE"];

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, userType, responderRole, stationLocation } = req.body;

    if (!name || !email || !password || !userType) {
      return res.status(400).json({ message: "name, email, password, userType required" });
    }
    if (!USER_TYPES.includes(userType)) {
      return res.status(400).json({ message: `Invalid userType. Use ${USER_TYPES.join(", ")}` });
    }

    let finalResponderRole = null;
    let stationLat = null;
    let stationLng = null;

    if (userType === "RESPONDER") {
      if (!responderRole || !RESPONDER_ROLES.includes(responderRole)) {
        return res.status(400).json({ message: `Invalid responderRole. Use ${RESPONDER_ROLES.join(", ")}` });
      }
      finalResponderRole = responderRole;

      stationLat = Number(stationLocation?.lat);
      stationLng = Number(stationLocation?.lng);
      if (!Number.isFinite(stationLat) || !Number.isFinite(stationLng)) {
        return res.status(400).json({ message: "stationLocation {lat,lng} required for responders" });
      }
    }

    const id = uuid();
    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, user_type, responder_role)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, name.trim(), normalizedEmail, passwordHash, userType, finalResponderRole]
    );

    if (userType === "RESPONDER") {
      await pool.query(
        `INSERT INTO responders (user_id, status, station_lat, station_lng)
         VALUES ($1, 'AVAILABLE', $2, $3)`,
        [id, stationLat, stationLng]
      );
    }

    return res.status(201).json({
      id,
      name: name.trim(),
      email: normalizedEmail,
      userType,
      responderRole: finalResponderRole,
      stationLocation: userType === "RESPONDER" ? { lat: stationLat, lng: stationLng } : null
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    if (err.code === "23505") return res.status(409).json({ message: "Email already registered" });

    return res.status(500).json({ message: "Register failed", error: err.message, code: err.code || null });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || "").toLowerCase().trim();
    if (!normalizedEmail || !password) return res.status(400).json({ message: "email and password required" });

    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, user_type, responder_role
       FROM users WHERE email=$1`,
      [normalizedEmail]
    );
    if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });

    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: u.id, userType: u.user_type, responderRole: u.responder_role },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      user: { id: u.id, name: u.name, email: u.email, userType: u.user_type, responderRole: u.responder_role }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Login failed", error: err.message });
  }
});

module.exports = router;
