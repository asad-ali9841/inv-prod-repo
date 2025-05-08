require("@shopify/shopify-api/adapters/node");
const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const {
  shopifyClientId,
  shopifyClientSecret,
  baseURL,
  shopifyStoreName,
} = require("../config");

const shopify = shopifyApi({
  apiKey: shopifyClientId,
  apiSecretKey: shopifyClientSecret,
  scopes: ["write_products", "read_products"],
  hostName: baseURL,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
});

const getClientCredentialsSession = async () => {
  const { session } = await shopify.auth.clientCredentials({
    shop: shopifyStoreName,
  });

  return session;
};

const getRestClient = async () => {
  const session = await getClientCredentialsSession();
  return new shopify.clients.Rest({ session, apiVersion: LATEST_API_VERSION });
};

module.exports = {
  shopify,
  getRestClient,
};
