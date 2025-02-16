const mongoose = require('mongoose');

// Update with your MongoDB connection string
const { DB_IP, DB_username, DB_password, DB_Name, DB_Cluster, redis_url} = require('../../config/index')
const uri = `mongodb+srv:/asadshah:O14cGOWioJtHBcHm-wms-cluster.jecslhm.mongodb.net/`;
//const uri1 = `mongodb+srv://${DB_username}:${DB_password}-${DB_IP}/${DB_Name}?retryWrites=true&w=majority`
console.log(uri)
//const URL = `mongodb+srv://asadshah:${DB_password}-cluster.jecslhm.mongodb.net/`
// const options = {
//   dbName: DB_Name, // Specify the database name here
//  // useNewUrlParser: true,
//   //useUnifiedTopology: true
// };

const ProductListsModel = require('../models/ProductLists'); // Adjust the path accordingly

async function migrateData() {
  try {
    await mongoose.connect(uri, {
        //dbName: 'Inventory-Database',
      //useNewUrlParser: true,
      //useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const batchSize = 1000;
    let processed = 0;
    let hasMore = true;

    while (hasMore) {
      const documents = await ProductListsModel.find({ labels: { $exists: false } })
        .limit(batchSize)
        .exec();

      if (documents.length === 0) {
        hasMore = false;
        break;
      }

      const bulkOps = documents.map(doc => {
        const labels = doc.data.map(item => item.label);
        return {
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { labels }, $unset: { data: "" } }
          }
        };
      });

      if (bulkOps.length > 0) {
        await ProductListsModel.bulkWrite(bulkOps);
        processed += bulkOps.length;
        console.log(`Processed ${processed} documents`);
      }
    }

    console.log('Migration completed successfully');
    mongoose.connection.close();
  } catch (error) {
    console.error('Migration failed:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

migrateData();
