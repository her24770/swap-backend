import { createServer } from "http";
import { conectarRedis } from "./persistencia/redisClient";
import { iniciarCronRecomendacion } from "./jobs/cronRecomendacion";
import { initSocketServer } from "./sockets/socketServer";
import app from "./app";
import { escribirLog } from "./observabilidad/logger";
import { iniciarAlertasSeguridad } from "./observabilidad/servicioAlertas";

const httpServer = createServer(app);
initSocketServer(httpServer);

const PORT = process.env.PORT || 3001;

conectarRedis()
    .then(() => {
        escribirLog("info", "redis.connected");
        iniciarAlertasSeguridad();
        iniciarCronRecomendacion();
    })
    .catch((error) => escribirLog("error", "redis.connection_failed", { error }));

httpServer.listen(PORT, () => {
    escribirLog("info", "server.started", { port: Number(PORT) });
});
