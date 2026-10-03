import { Server } from "socket.io";

// Módulo aislado sin dependencias propias para evitar imports circulares
// entre socketServer.ts (crea el Server) y servicioMensajeria.ts (emite eventos).

let io: Server | null = null;

export function setIO(instancia: Server): void {
    io = instancia;
}

export function getIO(): Server | null {
    return io;
}
