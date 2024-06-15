/* istanbul ignore file */

import dotenv from "dotenv";
dotenv.config() // read ".env"
import express from 'express';
import cors from 'cors';
import http from "http";
import mongoose from 'mongoose';
import app from "./app";
import { logger } from "./logger"
import { readFile } from "fs/promises";
import https from "https";
import { startWebSocketConnection } from "./websockets";

const app1 = express();
app1.use(cors({
  origin: '*' // Replace with your actual URL
}));


/** 
 * Init setup to connect to MongoDB
 * */ 
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PW}@${process.env.MONGO_CLUSTER}/?retryWrites=true&w=majority&appName=OceanCombat`;

/**
 * Test .env values
 */
// console.log("Username: " + process.env.MONGO_USER)
// console.log("PW: " + process.env.MONGO_PW)
// console.log("Cluster: " + process.env.MONGO_CLUSTER)

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
  //tls: true  // Etablishes TLS connection
});


    async function setup() {

    let mongodURI = process.env.DB_CONNECTION_STRING;
    if (!mongodURI) {
        logger.error(`Cannot start, no database configured. Set environment variable DB_CONNECTION_STRING. Use "memory" for MongoMemoryServer, anything else for real MongoDB server"`);
        process.exit(1);
    }
    if (mongodURI === "memory") {
        logger.info("Start MongoMemoryServer")
        const MMS = await import('mongodb-memory-server')
        const mongo = await MMS.MongoMemoryServer.create();
        mongodURI = mongo.getUri();

        logger.info(`Connect to mongod at ${mongodURI}`)
        await mongoose.connect(mongodURI);
    
        const shouldSSL = process.env.USE_SSL === "true";
        if(shouldSSL) {
            const [privateKey, publicSSLCert] = await Promise.all([
                readFile(process.env.SSL_KEY_FILE!),
                readFile(process.env.SSL_CRT_FILE!)
            ]);
    
            const httpsServer = https.createServer({key: privateKey, cert: publicSSLCert}, app);
            const HTTPS_PORT = parseInt(process.env.HTTPS_PORT!);
            httpsServer.listen(HTTPS_PORT, () => {
                console.log(`Listening for HTTPS at https://localhost:${HTTPS_PORT}`);
                
            })
        } else {
            const port = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3000;
            const httpServer = http.createServer(app);
            startWebSocketConnection(httpServer);
            httpServer.listen(port, () => {
                logger.info(`Listening for HTTP at http://localhost:${port}`);
            });
        }
    } else {
      try {
        // Connect the client to the server (optional starting in v4.7)
        await client.connect();
        console.log("Connection successfully etablished!");
        // Send a ping to confirm a successful connection
        await client.db("BitBusters").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
      } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
      }
        const expressServer = app.listen(process.env.SERVER_PORT || 3001, () => {
    console.log('Server Started PORT ==> ', process.env.SERVER_PORT || 3001);
  });
  startWebSocketConnection(expressServer);
    }
};

setup().catch(console.dir);
