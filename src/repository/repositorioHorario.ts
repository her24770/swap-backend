import prisma from "../persistencia/prismaClient";

export type DiaSemana =
    | "lunes"
    | "martes"
    | "miercoles"
    | "jueves"
    | "viernes"
    | "sabado"
    | "domingo";

export interface BloqueHorarioInput {
    dia: DiaSemana;
    hora_inicio: string;
    hora_fin: string;
}

export interface HorarioPersistido {
    id_tiempo: number;
    id_usuario: number;
    dia: DiaSemana;
    hora_inicio: Date | string;
    hora_fin: Date | string;
    estado: string | null;
}

export async function buscarHorariosPorUsuario(
    idUsuario: number
): Promise<HorarioPersistido[]> {
    return prisma.$queryRaw<HorarioPersistido[]>`
        SELECT
            td."id_tiempo",
            td."id_usuario",
            td."dia",
            td."hora_inicio",
            td."hora_fin",
            e."estado"
        FROM "Tiempo_Disponible" td
        LEFT JOIN "Estado" e ON e."id_estado" = td."estadoId_estado"
        WHERE td."id_usuario" = ${idUsuario}
        ORDER BY
            CASE td."dia"
                WHEN 'lunes' THEN 1
                WHEN 'martes' THEN 2
                WHEN 'miercoles' THEN 3
                WHEN 'jueves' THEN 4
                WHEN 'viernes' THEN 5
                WHEN 'sabado' THEN 6
                WHEN 'domingo' THEN 7
            END,
            td."hora_inicio"
    `;
}

export async function reemplazarHorariosUsuario(
    idUsuario: number,
    bloques: BloqueHorarioInput[]
): Promise<HorarioPersistido[]> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
            DELETE FROM "Tiempo_Disponible"
            WHERE "id_usuario" = ${idUsuario}
        `;

        for (const bloque of bloques) {
            await tx.$executeRaw`
                INSERT INTO "Tiempo_Disponible" ("id_usuario", "hora_inicio", "hora_fin", "dia")
                VALUES (
                    ${idUsuario},
                    ${bloque.hora_inicio}::time,
                    ${bloque.hora_fin}::time,
                    ${bloque.dia}::"Dias"
                )
            `;
        }

        return tx.$queryRaw<HorarioPersistido[]>`
            SELECT
                td."id_tiempo",
                td."id_usuario",
                td."dia",
                td."hora_inicio",
                td."hora_fin",
                e."estado"
            FROM "Tiempo_Disponible" td
            LEFT JOIN "Estado" e ON e."id_estado" = td."estadoId_estado"
            WHERE td."id_usuario" = ${idUsuario}
            ORDER BY
                CASE td."dia"
                    WHEN 'lunes' THEN 1
                    WHEN 'martes' THEN 2
                    WHEN 'miercoles' THEN 3
                    WHEN 'jueves' THEN 4
                    WHEN 'viernes' THEN 5
                    WHEN 'sabado' THEN 6
                    WHEN 'domingo' THEN 7
                END,
                td."hora_inicio"
        `;
    });
}
