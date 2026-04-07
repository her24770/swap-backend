import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import routes from "./api_rest/routes";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});