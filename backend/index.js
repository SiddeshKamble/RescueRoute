const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { testConnection } = require("./db");

const authRoutes = require("./routes/auth");
const emergencyRoutes = require("./routes/emergency");
const dispatchRoutes = require("./routes/dispatch");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use("/auth", authRoutes);
app.use("/emergencies", emergencyRoutes);
app.use("/dispatch", dispatchRoutes);

const PORT = process.env.PORT || 5050;

(async () => {
  try {
    await testConnection();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
