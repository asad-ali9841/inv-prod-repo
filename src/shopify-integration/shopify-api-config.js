require("@shopify/shopify-api/adapters/node");
const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const {
  shopifyClientId,
  shopifyClientSecret,
  baseURL,
  shopifyStoreName,
  hasShopifyIntegration,
} = require("../config");

const shopify = hasShopifyIntegration
  ? shopifyApi({
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
    })
  : null;

const getClientCredentialsSession = async () => {
  if (shopify) {
    const { session } = await shopify.auth.clientCredentials({
      shop: shopifyStoreName,
    });

    return session;
  }
};

const getRestClient = async () => {
  if (shopify) {
    const session = await getClientCredentialsSession();
    return new shopify.clients.Rest({
      session,
      apiVersion: LATEST_API_VERSION,
    });
  }
};

module.exports = {
  shopify,
  getRestClient,
};
