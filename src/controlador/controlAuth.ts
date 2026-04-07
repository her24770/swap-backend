import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import {
    buscarUsuarioPorEmail,
    buscarUsuarioPorCarnet,
    guardarUsuario,
} from "../repository/repositorioUsuario";

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/registro
 * Crea un nuevo usuario en la base de datos.
 * Retorna 409 si el correo o carnet ya están registrados.
 */
export async function registro(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { nombre, carnet, email_institucional, password, url_foto_perfil, descripcion } =
            req.body;

        // Verificar email duplicado
        const emailExistente = await buscarUsuarioPorEmail(email_institucional);
        if (emailExistente) {
            res.status(409).json({ message: "El correo institucional ya está registrado." });
            return;
        }

        // Verificar carnet duplicado
        const carnetExistente = await buscarUsuarioPorCarnet(Number(carnet));
        if (carnetExistente) {
            res.status(409).json({ message: "El carnet ya está registrado." });
            return;
        }

        // Hashear contraseña
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Guardar usuario
        const nuevoUsuario = await guardarUsuario({
            nombre,
            carnet: Number(carnet),
            email_institucional,
            password: passwordHash,
            url_foto_perfil: url_foto_perfil ?? "",
            descripcion: descripcion ?? null,
        });

        res.status(201).json({
            message: "Usuario creado exitosamente.",
            usuario: {
                id_usuario: nuevoUsuario.id_usuario,
                nombre: nuevoUsuario.nombre,
                carnet: nuevoUsuario.carnet,
                email_institucional: nuevoUsuario.email_institucional,
                url_foto_perfil: nuevoUsuario.url_foto_perfil,
                descripcion: nuevoUsuario.descripcion,
            },
        });
    } catch (error) {
        next(error);
    }
}