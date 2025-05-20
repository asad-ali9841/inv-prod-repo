const mongoose = require("mongoose");

const OAuthStateSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  shop: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Automatically expire after 10 minutes
  },
});

const OAuthState = mongoose.model("OAuthState", OAuthStateSchema);

module.exports = OAuthState;
