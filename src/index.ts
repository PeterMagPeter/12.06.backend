/* istanbul ignore file */

import dotenv from "dotenv";
dotenv.config(); // read ".env"
import express from 'express';
import cors from 'cors';
import http from "http";
import mongoose from 'mongoose';
import app from "./app";
import { logger } from "./logger";
import { readFile } from "fs/promises";
import https from "https";
import { startWebSocketConnection } from "./websockets";

/** 
 * Init setup to connect to MongoDB
 */ 
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = `mongodb+srv://TestUser:ThisIsPassword@oceancombat.3shvrzt.mongodb.net/?retryWrites=true&w=majority&appName=OceanCombat`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function setup() {
  let mongodURI = process.env.DB_CONNECTION_STRING || "test";
  
  if (!mongodURI) {
    logger.error(`Cannot start, no database configured. Set environment variable DB_CONNECTION_STRING. Use "memory" for MongoMemoryServer, anything else for real MongoDB server`);
    process.exit(1);
  }

  if (mongodURI === "memory") {
    logger.info("Start MongoMemoryServer");
    const MMS = await import('mongodb-memory-server');
    const mongo = await MMS.MongoMemoryServer.create();
    mongodURI = mongo.getUri();

    logger.info(`Connect to mongod at ${mongodURI}`);
    await mongoose.connect(mongodURI);
  
    const shouldSSL = true;
    if (shouldSSL) {
      const [privateKey, publicSSLCert] = await Promise.all([
        readFile('./cert/private.key'),
        readFile('./cert/public.crt')
      ]);

      const httpsServer = https.createServer({ key: privateKey, cert: publicSSLCert }, app);
      const HTTPS_PORT = 3001;
      httpsServer.listen(HTTPS_PORT, () => {
        console.log(`Listening for HTTPS at https://localhost:${HTTPS_PORT}`);
      });
    } else {
      const port = 3000;
      const httpServer = http.createServer(app);
      startWebSocketConnection(httpServer);
      httpServer.listen(port, () => {
        logger.info(`Listening for HTTP at http://localhost:${port}`);
      });
    }
  } else {
    try {
      // Connect the client to the server (optional starting in v4.7)
      await client.connect().then(() => { console.log("Connection successfully established!"); });
      
      // Send a ping to confirm a successful connection
      await client.db("BitBusters").command({ ping: 1 }).then(() => { console.log("Pinged your deployment. You successfully connected to MongoDB!"); });

      mongoose.connection.on('connected', () => {
        console.log('Mongoose connected to DB');
      });

      mongoose.connection.on('error', (err) => {
        console.error('Mongoose connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('Mongoose disconnected from DB');
      });

    } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
    }

    const expressServer = app.listen(3001, () => {
      console.log('Server Started PORT ==> 3001');
    });
    startWebSocketConnection(expressServer);
  }
}

setup().catch(console.dir);
