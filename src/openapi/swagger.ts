import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi";

const router = Router();

router.get("/openapi.json", (_req, res) => {
    res.type("application/vnd.oai.openapi+json;version=3.2").json(openApiDocument);
});

router.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
        customSiteTitle: "Swap API · OpenAPI",
        customCss: "",
        swaggerOptions: {
            displayRequestDuration: true,
            filter: true,
            persistAuthorization: true,
            tryItOutEnabled: true,
            withCredentials: true,
            tagsSorter: "alpha",
            operationsSorter: "method",
        },
    }),
);

export default router;
