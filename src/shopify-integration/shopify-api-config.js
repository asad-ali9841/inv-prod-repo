require("@shopify/shopify-api/adapters/node");
const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const { shopifyClientId, shopifyClientSecret, baseURL } = require("../config");

const shopify = shopifyApi({
  apiKey: shopifyClientId,
  apiSecretKey: shopifyClientSecret,
  scopes: [
    "write_products",
    "read_products",
    "read_inventory",
    "write_inventory",
  ],
  hostName: baseURL,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
});

const getClientCredentialsSession = async (shopifyStoreDomain) => {
  const { session } = await shopify.auth.clientCredentials({
    shop: shopifyStoreDomain,
  });

  return session;
};

const getRestClient = async (shopifyStoreDomain) => {
  const session = await getClientCredentialsSession(shopifyStoreDomain);
  return new shopify.clients.Rest({
    session,
    apiVersion: LATEST_API_VERSION,
  });
};

module.exports = {
  shopify,
  getRestClient,
};
