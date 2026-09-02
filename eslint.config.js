import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/**", "node_modules/**", "prisma/migrations/**", "embeddings/**"],
    },
    ...tseslint.configs.recommended,
    {
        rules: {
            // El proyecto ya usa `any` deliberadamente en varios repositorios
            // (filtros dinámicos de Prisma); no vale la pena bloquear el lint por eso.
            "@typescript-eslint/no-explicit-any": "off",
            // `declare global { namespace Express {...} }` es el patrón oficial de
            // Express para extender sus tipos — no es un namespace evitable.
            "@typescript-eslint/no-namespace": "off",
            // Patrón usado deliberadamente para descartar un campo por destructuring
            // (ej. `const { password: _, ...resto } = usuario`).
            "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
        },
    },
);
