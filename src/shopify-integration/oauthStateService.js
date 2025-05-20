const OAuthState = require("../database/models/OAuthState");

// Store state in database
const storeState = async (shop, state) => {
  await OAuthState.create({ shop, state });
  return state;
};

// Verify state and delete it (one-time use)
const verifyState = async (shop, state) => {
  const record = await OAuthState.findOne({ shop, state });

  if (!record) {
    return false;
  }

  // Delete the record after verification
  await OAuthState.deleteOne({ _id: record._id });

  return true;
};

module.exports = {
  storeState,
  verifyState,
};
