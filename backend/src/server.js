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

app.use(
  cors({
    origin: function(origin, callback) {
      callback(null, true)
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => res.send("TN 15 backend running"));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", ridesRouter);
app.use("/api", faresRouter);
app.use("/api", adminRouter);

// Error handler (keep last)
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: [env.cors.webOrigin, env.cors.adminOrigin] },
});

io.on("connection", (socket) => {
  socket.emit("hello", { ok: true, name: "TN 15 realtime" });
});

seedDefaultAdmin()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to seed default admin", err);
  })
  .finally(() => {
    server.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`TN 15 backend listening on http://localhost:${env.port}`);
    });
  });

