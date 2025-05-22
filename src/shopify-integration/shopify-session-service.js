const ShopifySession = require("../database/models/ShopifySession");

// Store a new session or update an existing one
const storeSession = async (session) => {
  try {
    const sessionData = {
      shop: session.shop,
      accessToken: session.accessToken,
      scope: session.scope,
      isOnline: session.isOnline || false,
      expires: session.expires || null,
      userId: session.onlineAccessInfo?.associated_user?.id || null,
      state: session.state || null,
      isActive: true,
    };

    // Update or create the session
    const result = await ShopifySession.findOneAndUpdate(
      { shop: session.shop },
      sessionData,
      { upsert: true, new: true }
    );

    return result;
  } catch (error) {
    console.error("Error storing session:", error);
    throw error;
  }
};

// Retrieve a session by shop domain
const retrieveSession = async (shop) => {
  try {
    const session = await ShopifySession.findOne({
      shop,
      isActive: true,
      $or: [{ expires: null }, { expires: { $gt: new Date() } }],
    });

    return session;
  } catch (error) {
    console.error("Error retrieving session:", error);
    return null;
  }
};

// Delete a session
const deleteSession = async (shop) => {
  try {
    await ShopifySession.findOneAndUpdate({ shop }, { isActive: false });
    return true;
  } catch (error) {
    console.error("Error deleting session:", error);
    return false;
  }
};

module.exports = {
  storeSession,
  retrieveSession,
  deleteSession,
};
