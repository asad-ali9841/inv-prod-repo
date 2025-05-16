require("@shopify/shopify-api/adapters/node");
const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const {
  shopifyClientId,
  shopifyClientSecret,
  hostName,
  baseURL,
} = require("../config");
const { retrieveSession } = require("./shopify-session-service");

const shopify = shopifyApi({
  apiKey: shopifyClientId,
  apiSecretKey: shopifyClientSecret,
  scopes: [
    "write_products",
    "read_products",
    "read_inventory",
    "write_inventory",
  ],
  hostName, // This should be just the domain, e.g., "api.3dlwms.com"
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
  redirectUrl: `${baseURL}/inventory/shopify/auth/callback`, // baseURL should include protocol
});

// New function to get a REST client using OAuth session
const getRestClient = async (shopifyStoreDomain) => {
  // Get the stored OAuth session
  const session = await retrieveSession(shopifyStoreDomain);

  if (!session) {
    throw new Error(`No OAuth session found for shop: ${shopifyStoreDomain}`);
  }

  return new shopify.clients.Rest({
    session: {
      shop: session.shop,
      accessToken: session.accessToken,
    },
    apiVersion: LATEST_API_VERSION,
  });
};

module.exports = {
  shopify,
  getRestClient,
};
