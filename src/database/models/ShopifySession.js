const mongoose = require("mongoose");

const shopifySessionSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  scope: {
    type: String,
    required: true,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  expires: {
    type: Date,
    default: null,
  },
  // Store additional session data as needed
  userId: String,
  state: String,
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("ShopifySession", shopifySessionSchema);
