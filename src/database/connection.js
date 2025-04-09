const redis = require('redis');
const mongoose = require("mongoose");
const { DB_IP, DB_username, DB_password, DB_Name, DB_Cluster, redis_url} = require('../config')
const uri = `mongodb+srv://${DB_username}:${DB_password}@${DB_IP}/?retryWrites=true&w=majority&appName=${DB_Cluster}`;
const options = {
  dbName: DB_Name, // Specify the database name here
 // useNewUrlParser: true,
  //useUnifiedTopology: true
};
//console.log(options)
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });

async function databaseConnection() {
  return new Promise(async (resolve, reject) => {
    try {
      mongoose.connect(uri, options);
      console.log('Inventory Database connected successfully to server');
      resolve({});
    } catch (error) {
      console.error('Error ============ On database connection', error);
      reject(error);
    }
  });
}

// connecting to redis
// const redis_Client = redis.createClient({
//   host: process.env.REDIS_HOST || 'redis',
//   port: process.env.REDIS_PORT || 6379,
// });

const redis_Client = redis.createClient({
  //url: 'redis://@redis:6379'
  //url: 'redis://@ec2-3-27-250-99.ap-southeast-2.compute.amazonaws.com:6379',
  //sebs aws url
  url: redis_url,
});
redis_Client.on('connect', function(){
    console.log('redis client connected');
});
redis_Client.on('error', function(err){
    console.log('Error', err);
});
// function getdata_base() {
//   if (!Object.keys(data_base).length) {
//     throw new Error("Bucket is not initialized. Ensure databaseConnection is called and completed.");
//   }
//   return data_base;
// }

async function connect_redis(){
  console.log(`Connecting to Redis at ${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`);
    await redis_Client.connect();
}

function getRedisClient() {
  return redis_Client;
}


module.exports = {
  databaseConnection ,
  connect_redis,
  getRedisClient,
  //getdata_base
};