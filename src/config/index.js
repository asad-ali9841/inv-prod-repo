const dotENv = require("dotenv");

if (process.env.NODE_ENV !== "prod") {
  let configFilePath = `./.env.${process.env.NODE_ENV}`;
  dotENv.config({ path: configFilePath });
} else {
  dotENv.config();
}

module.exports = {
  PORT: process.env.PORT,
  DB_IP: process.env.DB_IP,
  DB_username: process.env.DB_username,
  DB_password: process.env.DB_password,
  DB_Name: process.env.DB_Name,
  APP_SECRET: process.env.APP_SECRET,
  DB_Cluster: process.env.DB_Cluster,
  redis_url: process.env.redis_url,
  SYSTEM_Setup: process.env.SYSTEM_Setup,
  baseURL: process.env.baseURL,
  Routes: {
    userService: process.env.user_service,
    warehouseService: process.env.warehouse_service,
    liveService: process.env.live_service,
  },
  productAttributes: process.env.productAttributes,
  BUCKET_NAME: process.env.BUCKET_NAME,
  BUCKET_REGION: process.env.BUCKET_REGION,
  LOCAL_ACCESS_KEY: process.env.LOCAL_ACCESS_KEY,
  LOCAL_SECRET_KEY: process.env.LOCAL_SECRET_KEY,
  CLOUDFRONT_BASE_URL: process.env.CLOUDFRONT_BASE_URL,
  shopifyClientId: process.env.shopify_client_id,
  shopifyClientSecret: process.env.shopify_client_secret,
  shopifyStoreName: process.env.shopify_store_name,
  hasShopifyIntegration:
    Boolean(process.env.shopify_client_id) &&
    Boolean(process.env.shopify_client_secret) &&
    Boolean(process.env.shopify_store_name),
};
