import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import { config } from "@voltage/config";
import { storage, database, logger, getInstanceKey } from "@voltage/utils";
import { registerRoutes } from "@/routes/index.js";
import { errorHandler } from "@/middleware/error.middleware.js";

const instanceKey = getInstanceKey();

// create express app
const app = express();

// middleware
const bodyLimit =
	config.api.request_body_limit && parseInt(String(config.api.request_body_limit)) > 0 ? `${config.api.request_body_limit}mb` : undefined;
app.use(express.json(bodyLimit ? { limit: bodyLimit } : {}));
app.use(cors());

// register routes
registerRoutes(app);

// error handler
app.use(errorHandler);

async function startApiServer() {
	// configure services
	logger.setMetadata({ instance_key: instanceKey });

	// configure storage and database
	await storage.config(config.storage);

	// configure database
	database.config(config.database);
	await database.verifySchemaExists();

	// start api server
	const port = config.api.node_port;
	logger.insert("INFO", "Starting API service on :port...", { instance_key: instanceKey, port });

	app.listen(port, () => {
		logger.insert("INFO", "API service started successfully on :port!", { port });
	}).on("error", (error: Error) => {
		logger.insert("ERROR", "Failed to start API service!", {
			message: error.message,
			stack: error.stack
		});
	});
}

// start server
startApiServer();
