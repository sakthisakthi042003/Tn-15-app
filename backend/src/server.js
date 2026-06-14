const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { env } = require("./config/env");
const { seedDefaultAdmin } = require("./seed");
const { healthRouter } = require("./routes/health");
const { authRouter } = require("./routes/auth");
const { ridesRouter } = require("./routes/rides");
const { faresRouter } = require("./routes/fares");
const { adminRouter } = require("./routes/admin");

const app = express();

app.use(cors({ origin: function(origin, callback) { callback(null, true) }, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => res.send("TN 15 backend running"));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", ridesRouter);
app.use("/api", faresRouter);
app.use("/api", adminRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Store driver locations in memory
const driverLocations = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id)

  // Driver sends location update
  socket.on("driver:location", ({ rideId, lat, lng, driverId }) => {
    driverLocations.set(rideId, { lat, lng, driverId, updatedAt: Date.now() })
    // Broadcast to passenger room
    socket.to(`ride:${rideId}`).emit("driver:location", { lat, lng })
  })

  // Passenger joins ride room
  socket.on("passenger:join", ({ rideId }) => {
    socket.join(`ride:${rideId}`)
    // Send current driver location if available
    const loc = driverLocations.get(rideId)
    if (loc) socket.emit("driver:location", { lat: loc.lat, lng: loc.lng })
  })

  // Driver joins ride room
  socket.on("driver:join", ({ rideId }) => {
    socket.join(`ride:${rideId}`)
  })

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id)
  })
})

seedDefaultAdmin()
  .catch((err) => { console.error("Failed to seed default admin", err) })
  .finally(() => {
    server.listen(env.port, () => {
      console.log(`TN 15 backend listening on http://localhost:${env.port}`)
    })
  })