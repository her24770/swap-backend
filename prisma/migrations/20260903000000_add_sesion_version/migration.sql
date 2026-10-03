-- BG-04: invalidate previously issued JWTs after critical account changes.
ALTER TABLE "Usuario"
ADD COLUMN "sesion_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Moderador"
ADD COLUMN "sesion_version" INTEGER NOT NULL DEFAULT 1;
