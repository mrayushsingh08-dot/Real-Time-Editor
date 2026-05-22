import express          from "express"
import { createServer } from "http"
import { Server }       from "socket.io"
import { YSocketIO }    from "y-socket.io/dist/server"
import path             from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app = express()
app.use(express.json())

// ── Serve the built React app ─────────────────────────────────────────────────
// Docker copies the Vite build output into /app/public (see Dockerfile).
// This means ONE origin for both the webpage and the socket — no CORS issues.
app.use(express.static(path.join(__dirname, "public")))

const httpServer = createServer(app)

// ── Socket.IO ─────────────────────────────────────────────────────────────────
//
//  transports: ["websocket", "polling"]
//    WebSocket is tried first. AWS ALB (Application Load Balancer) supports
//    WebSocket natively when the listener protocol is HTTP/HTTPS — it forwards
//    the Upgrade header automatically. Polling is kept as a fallback.
//
//  pingInterval / pingTimeout
//    AWS ALB default idle timeout is 60 s. Sending a ping every 10 s keeps
//    the connection alive and detects dead clients within 15 s.
//
//  cors origin "*"
//    Safe here because the React app is served from the same Express process
//    (same origin). Set to your domain in production for extra security.
//
//  maxHttpBufferSize 100 MB
//    Default 1 MB is too small for Yjs documents with many operations.
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods:     ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  pingInterval:      10000,   // ms — ping sent every 10 s
  pingTimeout:       5000,    // ms — disconnect if no pong within 5 s
  maxHttpBufferSize: 1e8,     // 100 MB
})

// ── y-socket.io ───────────────────────────────────────────────────────────────
// Must be initialised AFTER io is fully configured.
const ySocketIO = new YSocketIO(io, {
  authenticate: (auth) => true
})

ySocketIO.initialize()



// ── Routes ───────────────────────────────────────────────────────────────────
// Health check — used by AWS ALB target-group health checks.
app.get("/health", (_req, res) => {
  res.status(200).json({ message: "ok", success: true })
})

// Catch-all — return index.html for any unknown path so React handles routing.
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`✅  CodeOrbit server running on port ${PORT}`)
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Gives in-flight WebSocket messages time to finish before the container stops.
// Important for zero-downtime ECS / Kubernetes rolling deployments.
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down gracefully")
  httpServer.close(() => {
    console.log("HTTP server closed")
    process.exit(0)
  })
})
