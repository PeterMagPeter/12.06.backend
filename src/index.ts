import dotenv from "dotenv";
dotenv.config(); // read ".env"
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import https from "https";
import http from "http";
import { readFile } from "fs/promises";
import { logger } from "./logger";
import { startWebSocketConnection } from "./websockets";
import app from "./app";

// Express app setup
const app1 = express();
app1.use(cors({
  origin: '*' // Replace with your actual URL
}));

/**
 * Init setup to connect to MongoDB
 */
const mongoURI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PW}@${process.env.MONGO_CLUSTER}/?retryWrites=true&w=majority&appName=OceanCombat`;

/**
 * Test .env values
 */
// console.log("Username: " + process.env.MONGO_USER)
// console.log("PW: " + process.env.MONGO_PW)
// console.log("Cluster: " + process.env.MONGO_CLUSTER)

// Mongoose connection setup
const connectWithRetry = () => {
  mongoose.connect(mongoURI, {
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
    serverSelectionTimeoutMS: 30000, // Increase server selection timeout
    socketTimeoutMS: 45000, // Increase socket timeout
    connectTimeoutMS: 30000, // Increase connection timeout
  }).then(() => {
    console.log("Connection successfully established!");
  }).catch((err) => {
    console.error("Error connecting to MongoDB:", err.message);
    setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
  });
};

// WebSocket and HTTPS/HTTP server setup
async function setup() {
  let mongodURI = process.env.DB_CONNECTION_STRING;
  if (!mongodURI) {
    logger.error("Cannot start, no database configured. Set environment variable DB_CONNECTION_STRING. Use 'memory' for MongoMemoryServer, anything else for real MongoDB server");
    process.exit(1);
  }

  if (mongodURI === "memory") {
    logger.info("Start MongoMemoryServer");
    const MMS = await import('mongodb-memory-server');
    const mongo = await MMS.MongoMemoryServer.create();
    mongodURI = mongo.getUri();

    logger.info(`Connect to mongod at ${mongodURI}`);
    await mongoose.connect(mongodURI);

    const shouldSSL = process.env.USE_SSL === "true";
    if (shouldSSL) {
      const [privateKey, publicSSLCert] = await Promise.all([
        readFile(process.env.SSL_KEY_FILE!),
        readFile(process.env.SSL_CRT_FILE!)
      ]);

      const httpsServer = https.createServer({ key: privateKey, cert: publicSSLCert }, app);
      const HTTPS_PORT = parseInt(process.env.HTTPS_PORT!);
      httpsServer.listen(HTTPS_PORT, () => {
        console.log(`Listening for HTTPS at https://localhost:${HTTPS_PORT}`);
      });
    } else {
      const port = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3000;
      const httpServer = http.createServer(app);
      startWebSocketConnection(httpServer);
      httpServer.listen(port, () => {
        logger.info(`Listening for HTTP at http://localhost:${port}`);
      });
    }
  } else {
    connectWithRetry();
    const expressServer = app.listen(process.env.SERVER_PORT || 3001, () => {
      console.log('Server Started PORT ==> ', process.env.SERVER_PORT || 3001);
    });
    startWebSocketConnection(expressServer);
  }
};

setup().catch(console.dir);
