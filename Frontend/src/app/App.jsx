import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef, useState, useEffect } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"
import { motion } from "framer-motion"

function App() {
  const editorRef    = useRef(null)
  const providerRef  = useRef(null)
  const ydocRef      = useRef(null)
  const bindingRef   = useRef(null)

  const [username, setUsername] = useState("")
  const [roomId,   setRoomId]   = useState("")
  const [users,    setUsers]    = useState([])

  /* ── helpers ─────────────────────────────────────────── */
  const getUserId = () => {
    let id = sessionStorage.getItem("userId")
    if (!id) {
      id = Math.random().toString(36).slice(2)
      sessionStorage.setItem("userId", id)
    }
    return id
  }

  const getRandomColor = () => {
    const colors = ["#ff6f61", "#6c5ce7", "#00b894", "#fdcb6e", "#0984e3"]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // FIX 1 ─ always connect to the same host that served the page.
  // Never hard-code "http://localhost:3000" – that breaks on every
  // deployed environment.
const getServerUrl = () => {
  if (window.location.port === "5173") {
    return "http://localhost:3000"
  }
  return window.location.origin
}

  /* ── Monaco mount ────────────────────────────────────── */
  const handleMount = (editor) => {
    editorRef.current = editor
    // If the provider is already running (effect fired first), bind now.
    if (ydocRef.current) {
      if (bindingRef.current) bindingRef.current.destroy()
      bindingRef.current = new MonacoBinding(
        ydocRef.current.getText("monaco"),
        editor.getModel(),
        new Set([editor])
      )
    }
  }

  /* ── validation ──────────────────────────────────────── */
  const isValidUsername = (n) => /^[A-Za-z][A-Za-z0-9_]*$/.test(n)
  const isValidRoomId   = (r) => /^(?=.*[A-Za-z])[A-Za-z0-9]{6,}$/.test(r)

  /* ── join handler ────────────────────────────────────── */
  const handleJoin = (e) => {
    e.preventDefault()
    const uname = e.target.username.value.trim()
    const rid   = e.target.roomId.value.trim()
    if (!uname || !rid)       return alert("Username and Room ID required")
    if (!isValidUsername(uname)) return alert("Username must start with a letter")
    if (!isValidRoomId(rid))  return alert("Room ID must be ≥ 6 chars and include letters")
    setUsername(uname)
    setRoomId(rid)
    window.history.replaceState({}, "", `?username=${uname}&roomId=${rid}`)
  }

  /* ── restore from URL on first load ─────────────────── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const u = p.get("username")
    const r = p.get("roomId")
    if (u && r) { setUsername(u); setRoomId(r) }
  }, [])

  /* ── Yjs + Socket.IO provider ───────────────────────── */
  useEffect(() => {
    if (!username || !roomId) return

    // FIX 2 ─ fresh Y.Doc in a ref (not useMemo) so cleanup can
    // call .destroy() without stale-closure issues.
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    // FIX 3 ─ transports: ["websocket"] skips the HTTP-polling →
    // WebSocket upgrade sequence that AWS ALB / nginx breaks.
    // (If you need polling fallback, enable sticky sessions on ALB.)
    const provider = new SocketIOProvider(
      getServerUrl(),
      roomId,
      ydoc,
      {
        autoConnect: true,
        socketIoClientOptions: {
        transports: ["websocket", "polling"],
         withCredentials: true
         },
      }
    )

    providerRef.current = provider

    provider.awareness.setLocalStateField("user", {
      username,
      color:  getRandomColor(),
      userId: getUserId(),
    })

    // FIX 4 ─ if Monaco already mounted before this effect ran,
    // create the binding now; otherwise handleMount will do it.
    if (editorRef.current) {
      if (bindingRef.current) bindingRef.current.destroy()
      bindingRef.current = new MonacoBinding(
        ydoc.getText("monaco"),
        editorRef.current.getModel(),
        new Set([editorRef.current])
      )
    }

    /* awareness → user list */
    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())
      setUsers(
        states
          .filter((s) => s.user?.username)
          .map((s) => s.user)
      )
    }
    updateUsers()
    provider.awareness.on("change", updateUsers)

    /* cursor broadcast */
    const cursorTimer = setInterval(() => {
      const pos = editorRef.current?.getPosition()
      if (pos)
        provider.awareness.setLocalStateField("cursor", {
          anchor: pos.column,
          head:   pos.column,
        })
    }, 200)

    const handleBeforeUnload = () =>
      provider.awareness.setLocalStateField("user", null)
    window.addEventListener("beforeunload", handleBeforeUnload)

    /* FIX 5 ─ proper cleanup order: binding → provider → ydoc */
    return () => {
      if (bindingRef.current) { bindingRef.current.destroy(); bindingRef.current = null }
      provider.disconnect()
      provider.destroy()
      ydoc.destroy()
      ydocRef.current  = null
      providerRef.current = null
      clearInterval(cursorTimer)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [username, roomId])

  /* ══════════════════════════════════════════════════════
     JOIN SCREEN
  ══════════════════════════════════════════════════════ */
  if (!username || !roomId) {
    return (
      <main className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#020617] to-[#0f172a] overflow-hidden relative">

        {/* animated blobs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-r from-purple-600 to-blue-400 opacity-30 blur-3xl"
          style={{ top: "-150px", left: "-150px" }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-r from-yellow-400 to-red-400 opacity-30 blur-2xl"
          style={{ bottom: "-100px", right: "-100px" }}
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 80, ease: "linear" }}
        />

        <motion.form
          onSubmit={handleJoin}
          autoComplete="off"
          className="backdrop-blur-xl bg-white/5 border border-white/10 p-10 rounded-3xl shadow-2xl flex flex-col gap-6 w-[360px]"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="text-white text-3xl font-bold text-center tracking-wide">
            🛸 CodeOrbit
          </h1>
          <p className="text-gray-300 text-center mb-2">
            Join a room &amp; code live with friends!
          </p>

          <input
            type="text"
            name="username"
            placeholder="Username"
            autoComplete="off"
            className="p-3 rounded-xl bg-white/10 text-white placeholder-gray-400 outline-none border border-white/20 focus:border-pink-500 transition"
          />
          <input
            type="text"
            name="roomId"
            placeholder="Room ID"
            autoComplete="off"
            className="p-3 rounded-xl bg-white/10 text-white placeholder-gray-400 outline-none border border-white/20 focus:border-purple-500 transition"
          />

          <motion.button
            type="submit"
            className="p-3 rounded-xl bg-pink-600 hover:bg-pink-700 font-semibold text-white shadow-lg"
            whileHover={{ scale: 1.05 }}
          >
            Join Room
          </motion.button>
        </motion.form>
      </main>
    )
  }

  /* ══════════════════════════════════════════════════════
     EDITOR SCREEN
  ══════════════════════════════════════════════════════ */
  return (
    <main className="h-screen w-full flex gap-5 p-5 bg-gradient-to-br from-[#1f1c2c] to-[#928dab] text-white overflow-hidden relative">

      {/* animated blobs */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-pink-500 to-purple-500 opacity-20 blur-3xl"
        style={{ top: "-150px", left: "-100px" }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 70, ease: "linear" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-r from-yellow-300 to-orange-400 opacity-20 blur-2xl"
        style={{ bottom: "-120px", right: "-80px" }}
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 90, ease: "linear" }}
      />

      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside className="w-1/4 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between z-10">
        <div>
          <h2 className="mb-4 text-lg font-semibold">👥 Users ({users.length})</h2>
          <div className="flex flex-col gap-2">
            {users.map((user, i) => (
              <div
                key={i}
                className="p-2 rounded-lg bg-white/10 flex items-center gap-2 hover:bg-white/20 transition"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: user.color }} />
                <span className="truncate">{user.username}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xs text-gray-200 break-all">
            🔑 Room ID:
            <div className="mt-1 text-white font-mono">{roomId}</div>
          </div>
        </div>

        <button
          onClick={() => {
            sessionStorage.clear()
            window.history.replaceState({}, "", "/")
            window.location.reload()
          }}
          className="w-full p-3 rounded-xl bg-pink-600 hover:bg-pink-700 font-semibold transition-transform hover:scale-105"
        >
          Exit Room 🐇
        </button>
      </aside>

      {/* ── EDITOR ──────────────────────────────────────── */}
      <section className="w-3/4 rounded-2xl overflow-hidden border border-white/10 shadow-xl flex flex-col z-10">
        <div className="p-3 bg-white/5 border-b border-white/10 flex justify-between items-center">
          <span>🤖 Real-Time Editor</span>
          <span className="text-xs text-gray-300">Room: {roomId}</span>
        </div>

        <Editor
          height="100%"
          defaultLanguage="javascript"
          defaultValue={`// Welcome to CodeOrbit\n// Start coding live with your friends!`}
          theme="vs-dark"
          onMount={handleMount}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }}
        />
      </section>
    </main>
  )
}

export default App
