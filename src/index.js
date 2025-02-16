require("dotenv").config()
const express = require("express");
const axios = require('axios');
const { PORT, SYSTEM_Setup} = require("./config");
const expressApp = require("./express-app");
const { databaseConnection, connect_redis} = require("./database/connection");
const { seedDatabase } = require('./database/seeding/seed')

const startServer = async () => {
  const app = express();
  connect_redis()
  .catch(err=>{
    console.log(err);
    process.exit();
  });
  // database connection here

  // Establish the database connection
  databaseConnection()
    .then(() => {
      // Now that the connection is established, call createCollections
      if(SYSTEM_Setup ==='true') return seedDatabase();
    })
    .then(() => {
      // After creating collections, start the express application
      // calling api to get rbac class 
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        //url: 'http://localhost:3001/role/services',
        url: 'http://rbaclb-1460536057.ap-southeast-2.elb.amazonaws.com/role/services',
        headers: { }
      };
      axios.request(config)
      .then((response) => {
        //console.log(JSON.stringify(response.data));
        class RBACTmpClass{
          constructor(){
            this.roles = response.data.rbac.roles;
            //console.log(this.roles)
            // TODO update this function definition make it dynamic
            this.checkPermission = new Function('role', 'resource', 'action', `
            const rolePermissions = this.roles[role]?.permissions[resource];
            const permissions = rolePermissions?._doc || rolePermissions;
            return !!permissions && permissions[action] === true;
            `);
            console.log('ROLES INITIALIZED FOR Inventory SERVICE')
          };
        };
        let rbac = new RBACTmpClass();
        expressApp(app, rbac);
      })
      .catch((error) => {
        console.log(error);
      });
      //expressApp(app, '');
    })
    .catch((err) => {
      // Handle any errors that occur during the connection or collection creation
      console.log(err);
      process.exit();
    });
  app.listen(PORT, () => {
      console.log(`Inventory Management --> Service --> Listening on PORT ${PORT}`);
    })
    .on("error", (err) => {
      console.log(err);
      process.exit();
    });
};

startServer();
