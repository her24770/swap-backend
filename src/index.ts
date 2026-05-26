import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import routes from "./api_rest/routes";
import { conectarRedis } from "./persistencia/redisClient";
import { iniciarCronRecomendacion } from "./jobs/cronRecomendacion";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3001;

app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
});

conectarRedis()
    .then(() => {
        console.log("Redis conectado");
        iniciarCronRecomendacion();
    })
    .catch((err) => console.error("Error conectando Redis:", err));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ success: false, message: `Error de archivo: ${err.message}` });
        return;
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});