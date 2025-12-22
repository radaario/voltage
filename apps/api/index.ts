import { config as appConfig } from "@voltage/core/config";
import { storage, database, logger, getInstanceKey } from "@voltage/utils";

import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";

import { registerRoutes } from "@/routes/index.js";
import { errorHandler } from "@/middleware/error.middleware.js";

const instanceKey = getInstanceKey();

// create express app
const app = express();

// middleware
const bodyLimit =
	appConfig.api.request_body_limit && parseInt(String(appConfig.api.request_body_limit)) > 0
		? `${appConfig.api.request_body_limit}mb`
		: undefined;
app.use(express.json(bodyLimit ? { limit: bodyLimit } : {}));
app.use(cors());

// register routes
registerRoutes(app);

// error handler
app.use(errorHandler);

async function startApiServer() {
	// configure services
	logger.setMetadata("API", { instance_key: instanceKey });

	// configure storage and database
	await storage.config(appConfig.storage);

	// configure database
	database.config(appConfig.database);
	await database.verifySchemaExists();

	// start api server
	const port = appConfig.api.node_port;
	logger.insert("API", "INFO", "Starting API service...");

	app.listen(port, () => {
		logger.insert("API", "INFO", "API service started successfully on :port!", { port });
	}).on("error", (error: Error) => {
		logger.insert("API", "ERROR", "Failed to start API service!", {
			message: error.message,
			stack: error.stack
		});
	});
}

// start server
startApiServer();
