const session = require("express-session");
const cookieParser = require("cookie-parser");
const MongoStore = require("connect-mongo");
const {
  SESSION_SECRET,
  DB_username,
  DB_password,
  DB_IP,
  DB_Cluster,
} = require("../../config");

const uri = `mongodb+srv://${DB_username}:${DB_password}@${DB_IP}/?retryWrites=true&w=majority&appName=${DB_Cluster}`;

// Create a middleware that only applies to Shopify routes
const shopifySessionMiddleware = (req, res, next) => {
  // Apply cookie-parser and session middleware for Shopify routes
  return cookieParser()(req, res, () => {
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      store: MongoStore.create({
        mongoUrl: uri,
        collectionName: "shopify_api_sessions", // Custom collection name
        ttl: 24 * 60 * 60, // Session TTL (1 day in seconds)
        autoRemove: "native", // Use MongoDB's TTL index
      }),
      cookie: {
        secure: "auto",
        sameSite: "none", // Important for cross-domain cookies
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })(req, res, next);
  });
};

module.exports = shopifySessionMiddleware;
