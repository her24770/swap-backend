# Builds reproducibles

Las imágenes se construyen únicamente a partir de entradas versionadas e
inmutables:

- `package-lock.json` es obligatorio y el Dockerfile usa `npm ci`; un cambio en
  `package.json` sin actualizar el lock hace fallar el build.
- `embeddings/requirements.lock` fija todo el árbol de Python con hashes y pip
  instala con `--require-hashes`.
- Cada `FROM` y cada imagen externa de Compose está fijada por digest SHA-256.
- Los paquetes Alpine instalados fuera de la imagen base tienen versión exacta.
- El modelo de embeddings está fijado al commit
  `faf4aa4225822f3bc6376869cb1164e8e3feedd0` de Hugging Face y el runtime opera
  sin red (`local_files_only=True`).
- `SOURCE_DATE_EPOCH` controla los timestamps del build. Para un commit se usa
  su fecha Unix, no la hora en que se ejecutó Docker.

## Verificación local

Se requiere Docker Buildx. El repositorio debe estar limpio para asegurar que
el contexto representa exactamente `HEAD`:

```bash
./scripts/verificarBuildReproducible.sh api
./scripts/verificarBuildReproducible.sh embeddings
./scripts/verificarBuildReproducible.sh backup
```

Cada comando construye la misma imagen dos veces sin caché para
`linux/amd64`, deshabilita metadatos variables de provenance/SBOM, exporta OCI
con timestamps normalizados y exige que ambos manifiestos tengan el mismo
digest. `PLATFORM=linux/arm64` permite comprobar otra arquitectura; los digests
solo se comparan dentro de la misma plataforma.

Durante desarrollo puede probarse un árbol aún no confirmado con
`ALLOW_DIRTY=1`, pero ese resultado no demuestra reproducibilidad de un commit.

Para un build normal del dueño del servidor:

```bash
export SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

El despliegue no forma parte de la verificación local. Sigue siendo
responsabilidad del dueño del servidor.

## Actualizar dependencias fijadas

Las actualizaciones son explícitas y deben viajar juntas en el mismo commit:

1. npm: modificar `package.json`, ejecutar `npm install --package-lock-only` y
   validar con `npm ci`.
2. Python: modificar `embeddings/requirements.txt` y regenerar el lock con la
   misma imagen base:

   ```bash
   docker run --rm \
     -v "$PWD/embeddings:/src" -w /src \
     python:3.11.17-slim-trixie@sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce \
     sh -c 'python -m pip install --no-cache-dir pip-tools==7.4.1 && pip-compile --no-strip-extras --generate-hashes --resolver=backtracking --output-file=requirements.lock requirements.txt'
   ```

3. Imágenes: obtener el digest nuevo con
   `docker buildx imagetools inspect IMAGEN:TAG --format '{{.Manifest.Digest}}'`
   y actualizar juntos Dockerfiles y Compose.
4. Modelo: elegir un commit concreto del repositorio de Hugging Face y cambiar
   `EMBEDDING_MODEL_REVISION`; nunca volver a `main` o a una descarga sin
   revisión.
5. Ejecutar las pruebas y los tres comandos de verificación anteriores.

"Equivalente" significa mismo digest de manifiesto OCI para el mismo commit y
plataforma. No incluye volúmenes, secretos, bases de datos ni configuración de
ejecución del servidor.
