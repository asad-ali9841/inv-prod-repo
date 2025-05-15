require("dotenv").config();
const express = require("express");
const { PORT, SYSTEM_Setup } = require("./config");
const expressApp = require("./express-app");
const { databaseConnection, connect_redis } = require("./database/connection");
const { seedDatabase } = require("./database/seeding/seed");

const startServer = async () => {
  const app = express();
  connect_redis().catch((err) => {
    console.log(err);
    process.exit();
  });
  // database connection here

  // Establish the database connection
  databaseConnection()
    .then(() => {
      // Now that the connection is established, call createCollections
      if ([true, "true"].includes(SYSTEM_Setup)) return seedDatabase();
    })
    .then(() => {
      expressApp(app);
    })
    .catch((err) => {
      // Handle any errors that occur during the connection or collection creation
      console.log(err);
      process.exit();
    });
  app
    .listen(PORT, () => {
      console.log(
        `Inventory Management --> Service --> Listening on PORT ${PORT}`
      );
    })
    .on("error", (err) => {
      console.log(err);
      process.exit();
    });
};

startServer();
