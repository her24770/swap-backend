import { createServer } from "http";
import { Server } from "socket.io";
import { conectarRedis } from "./persistencia/redisClient";
import { iniciarCronRecomendacion } from "./jobs/cronRecomendacion";
import app from "./app";

const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3001;

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
});

conectarRedis()
    .then(() => {
        console.log("Redis conectado");
        iniciarCronRecomendacion();
    })
    .catch((err) => console.error("Error conectando Redis:", err));

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});