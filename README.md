# 🚀 CodeOrbit — Real-Time Collaborative Code Editor

**CodeOrbit** is a modern, real-time collaborative code editor that allows multiple users to join a shared room and code together instantly — similar to Google Docs, but for developers.

Built using **React, Monaco Editor, Yjs, and Socket.IO**, and fully deployed on **AWS (ECS, ECR, ALB)**.

---

## 🌐 Live Demo

👉 https://real-time-editor-07mi.onrender.com

---

## ✨ Features

- ⚡ Real-time multi-user collaboration
- 👥 Live user presence tracking
- 🎨 Unique color identity for each user
- 🧠 Conflict-free editing using CRDT (Yjs)
- 🧩 Monaco Editor (VS Code-like experience)
- 🔐 Room-based collaboration system
- 🌈 Modern animated UI (Framer Motion)
- ☁️ Fully deployed on AWS (ECS + ALB)

---

## 🏗️ Tech Stack

### Frontend
- React (Vite)
- Monaco Editor (`@monaco-editor/react`)
- Yjs + `y-monaco`
- Socket.IO Client
- Framer Motion

### Backend
- Node.js
- Express
- Socket.IO
- Yjs (`y-socket.io`)

### DevOps / Deployment
- Docker (multi-stage build)
- AWS ECR (container registry)
- AWS ECS (Fargate)
- AWS ALB (Application Load Balancer)

---

## 🧠 How It Works

1. User enters **username** and **room ID**
2. A shared **Yjs document (CRDT)** is created
3. Socket.IO syncs changes across all clients
4. Monaco Editor is bound to Yjs via `MonacoBinding`
5. Awareness API handles:
   - User presence
   - Cursor position
   - User identity

---

