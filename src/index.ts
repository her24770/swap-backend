import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3001;

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});