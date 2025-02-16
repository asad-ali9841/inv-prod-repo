const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const baseOptions = {
  discriminatorKey: "itemType1", // This will store the item type
  //collection: "items", // You can keep them all in one collection
};

const ItemSharedSchema = new Schema({
  productId: {
    type: String,
    required: true
  },
  variantIds: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    required: true,
  },
  variantCount: {
    type: Number,
    default: 1,
    required: true,
  },
  itemType1: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  activity: {
    type: Array,
    default: []
  },

  createdAt: {
    type: Number,
    default: () => Date.now(), // Default to current UNIX timestamp
    immutable: true,
  },

  updatedAt: {
    type: Number,
    default: () => Date.now(), // Default to current UNIX timestamp
  },
}, baseOptions);

const ItemShared = mongoose.model("ItemShared", ItemSharedSchema);
module.exports = ItemShared;
