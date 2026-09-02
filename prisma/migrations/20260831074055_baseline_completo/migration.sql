-- CreateEnum
CREATE TYPE "Dias" AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');

-- CreateTable
CREATE TABLE "Usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "carnet" INTEGER NOT NULL,
    "email_institucional" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "url_foto_perfil" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "calificacion" DECIMAL(5,2),
    "total_resenas" INTEGER NOT NULL DEFAULT 0,
    "reportes_recibidos" INTEGER NOT NULL DEFAULT 0,
    "tiempo_suspendido" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "Moderador" (
    "id_moderador" SERIAL NOT NULL,
    "usuario" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "id_tipo_moderador" INTEGER NOT NULL,
    "tiempo_suspendido" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Moderador_pkey" PRIMARY KEY ("id_moderador")
);

-- CreateTable
CREATE TABLE "Tipo_Moderador" (
    "id_tipo_moderador" SERIAL NOT NULL,
    "tipo_moderador" VARCHAR(100) NOT NULL,

    CONSTRAINT "Tipo_Moderador_pkey" PRIMARY KEY ("id_tipo_moderador")
);

-- CreateTable
CREATE TABLE "Etiqueta" (
    "id_etiqueta" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "id_etiqueta_padre" INTEGER,

    CONSTRAINT "Etiqueta_pkey" PRIMARY KEY ("id_etiqueta")
);

-- CreateTable
CREATE TABLE "Motivo_Reporte" (
    "id_motivo" SERIAL NOT NULL,
    "motivo" TEXT NOT NULL,

    CONSTRAINT "Motivo_Reporte_pkey" PRIMARY KEY ("id_motivo")
);

-- CreateTable
CREATE TABLE "Palabra_Restringida" (
    "id_palabra" SERIAL NOT NULL,
    "palabra" VARCHAR(100) NOT NULL,

    CONSTRAINT "Palabra_Restringida_pkey" PRIMARY KEY ("id_palabra")
);

-- CreateTable
CREATE TABLE "Tipo_Perfil" (
    "id_tipo_perfil" SERIAL NOT NULL,
    "tipo_perfil" VARCHAR(100) NOT NULL,

    CONSTRAINT "Tipo_Perfil_pkey" PRIMARY KEY ("id_tipo_perfil")
);

-- CreateTable
CREATE TABLE "Tipo_Contacto" (
    "id_tipo_contacto" SERIAL NOT NULL,
    "tipo_contacto" VARCHAR(100) NOT NULL,

    CONSTRAINT "Tipo_Contacto_pkey" PRIMARY KEY ("id_tipo_contacto")
);

-- CreateTable
CREATE TABLE "Estado" (
    "id_estado" SERIAL NOT NULL,
    "estado" VARCHAR(100) NOT NULL,

    CONSTRAINT "Estado_pkey" PRIMARY KEY ("id_estado")
);

-- CreateTable
CREATE TABLE "Contactos" (
    "id_contacto" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo_contacto" INTEGER NOT NULL,
    "valor" VARCHAR(255) NOT NULL,

    CONSTRAINT "Contactos_pkey" PRIMARY KEY ("id_contacto")
);

-- CreateTable
CREATE TABLE "Tiempo_Disponible" (
    "id_tiempo" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin" TIME NOT NULL,
    "dia" "Dias" NOT NULL,
    "estadoId_estado" INTEGER,

    CONSTRAINT "Tiempo_Disponible_pkey" PRIMARY KEY ("id_tiempo")
);

-- CreateTable
CREATE TABLE "Certificacion" (
    "id_certificacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "ruta_pdf" VARCHAR(255) NOT NULL,
    "lugar_emision" VARCHAR(100) NOT NULL,
    "id_etiqueta" INTEGER NOT NULL,

    CONSTRAINT "Certificacion_pkey" PRIMARY KEY ("id_certificacion")
);

-- CreateTable
CREATE TABLE "Anuncio" (
    "id_anuncio" SERIAL NOT NULL,
    "titulo" VARCHAR(100) NOT NULL,
    "imagen_url" VARCHAR(255) NOT NULL DEFAULT '',
    "descripcion" VARCHAR(255) NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_anuncio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anuncio_pkey" PRIMARY KEY ("id_anuncio")
);

-- CreateTable
CREATE TABLE "Eventos" (
    "id_evento" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "peso" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Eventos_pkey" PRIMARY KEY ("id_evento")
);

-- CreateTable
CREATE TABLE "Publicacion" (
    "id_publicacion" SERIAL NOT NULL,
    "titulo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "precio" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "estado" INTEGER NOT NULL,
    "tipo_publicacion" INTEGER NOT NULL,
    "me_gusta" INTEGER NOT NULL DEFAULT 0,
    "fecha_publicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario" INTEGER NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "embedding" vector(384),

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id_publicacion")
);

-- CreateTable
CREATE TABLE "Imagen_Publicacion" (
    "id_imagen" SERIAL NOT NULL,
    "url_imagen" VARCHAR(255) NOT NULL,
    "id_publicacion" INTEGER NOT NULL,

    CONSTRAINT "Imagen_Publicacion_pkey" PRIMARY KEY ("id_imagen")
);

-- CreateTable
CREATE TABLE "Resena" (
    "id_resena" SERIAL NOT NULL,
    "contenido" TEXT NOT NULL,
    "calificacion" INTEGER NOT NULL DEFAULT 0,
    "me_gusta" INTEGER NOT NULL DEFAULT 0,
    "id_emisor" INTEGER NOT NULL,
    "id_receptor" INTEGER NOT NULL,
    "id_tipo_resena" INTEGER NOT NULL,
    "fecha_resena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resena_pkey" PRIMARY KEY ("id_resena")
);

-- CreateTable
CREATE TABLE "TipoResena" (
    "id_tipo_resena" SERIAL NOT NULL,
    "tipo_resena" VARCHAR(100) NOT NULL,

    CONSTRAINT "TipoResena_pkey" PRIMARY KEY ("id_tipo_resena")
);

-- CreateTable
CREATE TABLE "Conversacion" (
    "id_conversacion" SERIAL NOT NULL,
    "id_usuario_1" INTEGER NOT NULL,
    "id_usuario_2" INTEGER NOT NULL,
    "estado_conversacion" INTEGER NOT NULL,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id_conversacion")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id_mensaje" SERIAL NOT NULL,
    "id_conversacion" INTEGER NOT NULL,
    "id_emisor" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado_mensaje" INTEGER NOT NULL,
    "fecha_enviado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id_mensaje")
);

-- CreateTable
CREATE TABLE "Contexto_Conversacion" (
    "id_contexto" SERIAL NOT NULL,
    "id_conversacion" INTEGER NOT NULL,
    "id_publicacion" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_contexto" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contexto_Conversacion_pkey" PRIMARY KEY ("id_contexto")
);

-- CreateTable
CREATE TABLE "Acuerdo" (
    "id_acuerdo" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_publicacion" INTEGER NOT NULL,
    "fecha_entrega" TIMESTAMP(3) NOT NULL,
    "lugar_entrega" VARCHAR(100) NOT NULL,
    "observaciones" VARCHAR(200) NOT NULL,
    "id_conversacion" INTEGER NOT NULL,
    "estado" INTEGER NOT NULL,
    "id_ofertante" INTEGER NOT NULL,

    CONSTRAINT "Acuerdo_pkey" PRIMARY KEY ("id_acuerdo")
);

-- CreateTable
CREATE TABLE "Reporte" (
    "id_reporte" SERIAL NOT NULL,
    "id_emisor" INTEGER NOT NULL,
    "id_receptor" INTEGER NOT NULL,
    "id_publicacion" INTEGER,
    "id_mensaje" INTEGER,
    "motivo" INTEGER NOT NULL,
    "observaciones" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" INTEGER NOT NULL,
    "link_imagen" TEXT NOT NULL DEFAULT '',
    "id_moderador" INTEGER,

    CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id_reporte")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id_notificacion" SERIAL NOT NULL,
    "mensaje" TEXT NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_estado" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateTable
CREATE TABLE "Usuario_Etiqueta" (
    "id_usuario" INTEGER NOT NULL,
    "id_etiqueta" INTEGER NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "Usuario_Etiqueta_pkey" PRIMARY KEY ("id_usuario","id_etiqueta")
);

-- CreateTable
CREATE TABLE "Publicacion_Etiquetas" (
    "id_publicacion" INTEGER NOT NULL,
    "id_etiqueta" INTEGER NOT NULL,

    CONSTRAINT "Publicacion_Etiquetas_pkey" PRIMARY KEY ("id_publicacion","id_etiqueta")
);

-- CreateTable
CREATE TABLE "Usuario_Publicacion" (
    "id_usuario" INTEGER NOT NULL,
    "id_publicacion" INTEGER NOT NULL,
    "is_like" BOOLEAN NOT NULL,
    "is_save" BOOLEAN NOT NULL,

    CONSTRAINT "Usuario_Publicacion_pkey" PRIMARY KEY ("id_usuario","id_publicacion")
);

-- CreateTable
CREATE TABLE "evento_recomendacion" (
    "tipo_evento" TEXT NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "evento_recomendacion_pkey" PRIMARY KEY ("tipo_evento")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_carnet_key" ON "Usuario"("carnet");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_institucional_key" ON "Usuario"("email_institucional");

-- CreateIndex
CREATE UNIQUE INDEX "Moderador_usuario_key" ON "Moderador"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Tipo_Moderador_tipo_moderador_key" ON "Tipo_Moderador"("tipo_moderador");

-- CreateIndex
CREATE UNIQUE INDEX "Etiqueta_nombre_key" ON "Etiqueta"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Motivo_Reporte_motivo_key" ON "Motivo_Reporte"("motivo");

-- CreateIndex
CREATE UNIQUE INDEX "Palabra_Restringida_palabra_key" ON "Palabra_Restringida"("palabra");

-- CreateIndex
CREATE UNIQUE INDEX "Tipo_Perfil_tipo_perfil_key" ON "Tipo_Perfil"("tipo_perfil");

-- CreateIndex
CREATE UNIQUE INDEX "Tipo_Contacto_tipo_contacto_key" ON "Tipo_Contacto"("tipo_contacto");

-- CreateIndex
CREATE UNIQUE INDEX "Estado_estado_key" ON "Estado"("estado");

-- CreateIndex
CREATE INDEX "Publicacion_estado_fecha_publicacion_tipo_publicacion_idx" ON "Publicacion"("estado", "fecha_publicacion", "tipo_publicacion");

-- CreateIndex
CREATE UNIQUE INDEX "TipoResena_tipo_resena_key" ON "TipoResena"("tipo_resena");

-- CreateIndex
CREATE UNIQUE INDEX "Conversacion_id_usuario_1_id_usuario_2_key" ON "Conversacion"("id_usuario_1", "id_usuario_2");

-- CreateIndex
CREATE INDEX "Contexto_Conversacion_id_conversacion_idx" ON "Contexto_Conversacion"("id_conversacion");

-- CreateIndex
CREATE INDEX "Contexto_Conversacion_id_publicacion_idx" ON "Contexto_Conversacion"("id_publicacion");

-- CreateIndex
CREATE UNIQUE INDEX "Contexto_Conversacion_id_conversacion_id_publicacion_key" ON "Contexto_Conversacion"("id_conversacion", "id_publicacion");

-- CreateIndex
CREATE INDEX "Acuerdo_fecha_entrega_id_publicacion_idx" ON "Acuerdo"("fecha_entrega", "id_publicacion");

-- CreateIndex
CREATE INDEX "Usuario_Etiqueta_id_etiqueta_idx" ON "Usuario_Etiqueta"("id_etiqueta");

-- CreateIndex
CREATE INDEX "Usuario_Etiqueta_id_usuario_idx" ON "Usuario_Etiqueta"("id_usuario");

-- CreateIndex
CREATE INDEX "Publicacion_Etiquetas_id_etiqueta_idx" ON "Publicacion_Etiquetas"("id_etiqueta");

-- CreateIndex
CREATE INDEX "Publicacion_Etiquetas_id_etiqueta_id_publicacion_idx" ON "Publicacion_Etiquetas"("id_etiqueta", "id_publicacion");

-- AddForeignKey
ALTER TABLE "Moderador" ADD CONSTRAINT "Moderador_id_tipo_moderador_fkey" FOREIGN KEY ("id_tipo_moderador") REFERENCES "Tipo_Moderador"("id_tipo_moderador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etiqueta" ADD CONSTRAINT "Etiqueta_id_etiqueta_padre_fkey" FOREIGN KEY ("id_etiqueta_padre") REFERENCES "Etiqueta"("id_etiqueta") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contactos" ADD CONSTRAINT "Contactos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contactos" ADD CONSTRAINT "Contactos_tipo_contacto_fkey" FOREIGN KEY ("tipo_contacto") REFERENCES "Tipo_Contacto"("id_tipo_contacto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tiempo_Disponible" ADD CONSTRAINT "Tiempo_Disponible_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tiempo_Disponible" ADD CONSTRAINT "Tiempo_Disponible_estadoId_estado_fkey" FOREIGN KEY ("estadoId_estado") REFERENCES "Estado"("id_estado") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificacion" ADD CONSTRAINT "Certificacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificacion" ADD CONSTRAINT "Certificacion_id_etiqueta_fkey" FOREIGN KEY ("id_etiqueta") REFERENCES "Etiqueta"("id_etiqueta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anuncio" ADD CONSTRAINT "Anuncio_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_estado_fkey" FOREIGN KEY ("estado") REFERENCES "Estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_tipo_publicacion_fkey" FOREIGN KEY ("tipo_publicacion") REFERENCES "Tipo_Perfil"("id_tipo_perfil") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imagen_Publicacion" ADD CONSTRAINT "Imagen_Publicacion_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "Publicacion"("id_publicacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resena" ADD CONSTRAINT "Resena_id_emisor_fkey" FOREIGN KEY ("id_emisor") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resena" ADD CONSTRAINT "Resena_id_receptor_fkey" FOREIGN KEY ("id_receptor") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resena" ADD CONSTRAINT "Resena_id_tipo_resena_fkey" FOREIGN KEY ("id_tipo_resena") REFERENCES "TipoResena"("id_tipo_resena") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_id_usuario_1_fkey" FOREIGN KEY ("id_usuario_1") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_id_usuario_2_fkey" FOREIGN KEY ("id_usuario_2") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_estado_conversacion_fkey" FOREIGN KEY ("estado_conversacion") REFERENCES "Estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "Conversacion"("id_conversacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_id_emisor_fkey" FOREIGN KEY ("id_emisor") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_estado_mensaje_fkey" FOREIGN KEY ("estado_mensaje") REFERENCES "Estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contexto_Conversacion" ADD CONSTRAINT "Contexto_Conversacion_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "Conversacion"("id_conversacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contexto_Conversacion" ADD CONSTRAINT "Contexto_Conversacion_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "Publicacion"("id_publicacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contexto_Conversacion" ADD CONSTRAINT "Contexto_Conversacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acuerdo" ADD CONSTRAINT "Acuerdo_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acuerdo" ADD CONSTRAINT "Acuerdo_id_ofertante_fkey" FOREIGN KEY ("id_ofertante") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acuerdo" ADD CONSTRAINT "Acuerdo_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "Publicacion"("id_publicacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acuerdo" ADD CONSTRAINT "Acuerdo_estado_fkey" FOREIGN KEY ("estado") REFERENCES "Estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acuerdo" ADD CONSTRAINT "Acuerdo_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "Conversacion"("id_conversacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_id_emisor_fkey" FOREIGN KEY ("id_emisor") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_id_receptor_fkey" FOREIGN KEY ("id_receptor") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_motivo_fkey" FOREIGN KEY ("motivo") REFERENCES "Motivo_Reporte"("id_motivo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_estado_fkey" FOREIGN KEY ("estado") REFERENCES "Estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "Publicacion"("id_publicacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_id_mensaje_fkey" FOREIGN KEY ("id_mensaje") REFERENCES "Mensaje"("id_mensaje") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_id_moderador_fkey" FOREIGN KEY ("id_moderador") REFERENCES "Moderador"("id_moderador") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "Estado"("id_estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Etiqueta" ADD CONSTRAINT "Usuario_Etiqueta_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Etiqueta" ADD CONSTRAINT "Usuario_Etiqueta_id_etiqueta_fkey" FOREIGN KEY ("id_etiqueta") REFERENCES "Etiqueta"("id_etiqueta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion_Etiquetas" ADD CONSTRAINT "Publicacion_Etiquetas_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "Publicacion"("id_publicacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion_Etiquetas" ADD CONSTRAINT "Publicacion_Etiquetas_id_etiqueta_fkey" FOREIGN KEY ("id_etiqueta") REFERENCES "Etiqueta"("id_etiqueta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Publicacion" ADD CONSTRAINT "Usuario_Publicacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Publicacion" ADD CONSTRAINT "Usuario_Publicacion_id_publicacion_fkey" FOREIGN KEY ("id_publicacion") REFERENCES "Publicacion"("id_publicacion") ON DELETE RESTRICT ON UPDATE CASCADE;

