const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// --------------------
// EMERGENCIES
// --------------------

// List emergencies
app.get("/emergencies", async (req, res) => {
  try {
    const requests = await prisma.emergencyRequest.findMany();
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch emergencies" });
  }
});

// Create new emergency
app.post("/emergencies", async (req, res) => {
  try {
    const { type, location } = req.body;
    if (!type || !location) {
      return res.status(400).json({ error: "type and location are required" });
    }

    const newRequest = await prisma.emergencyRequest.create({
      data: { type, location },
    });

    // Emit to all connected clients
    io.emit("new_emergency", newRequest);

    res.status(201).json(newRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create emergency" });
  }
});

// --------------------
// RESPONDERS
// --------------------

// List all responders
app.get("/responders", async (req, res) => {
  try {
    const responders = await prisma.responders.findMany(); // note lowercase
    res.json(responders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch responders" });
  }
});

// --------------------
// SOCKET.IO
// --------------------

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  socket.emit("welcome", "Connected to RescueRoute server!");

  // Optionally: listen for responder updates in the future
  // socket.on("responder_update", async (data) => { ... });
});

// --------------------
// START SERVER
// --------------------

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
