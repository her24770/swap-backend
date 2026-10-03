import { createServer } from "http";
import { conectarRedis } from "./persistencia/redisClient";
import { iniciarCronRecomendacion } from "./jobs/cronRecomendacion";
import { initSocketServer } from "./sockets/socketServer";
import app from "./app";

const httpServer = createServer(app);
initSocketServer(httpServer);

const PORT = process.env.PORT || 3001;

conectarRedis()
    .then(() => {
        console.log("Redis conectado");
        iniciarCronRecomendacion();
    })
    .catch((err) => console.error("Error conectando Redis:", err));

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});