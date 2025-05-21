const mongoose = require("mongoose");
const {
  INTEGRATION_DOCUMENT_ID,
  fixedShopifyIntegrationFieldsToSync,
} = require("../../utils/constants");
const {
  deleteSession,
} = require("../../shopify-integration/shopify-session-service");

const shopifySchema = new mongoose.Schema(
  {
    isActive: {
      type: Boolean,
      default: false,
    },
    storeDomain: {
      type: String,
      default: "",
      validate: {
        validator: function (value) {
          // 'this' refers to the Shopify subdocument
          return !this.isActive || (value && value.length > 0);
        },
        message: "Store domain is required to enable Shopify integration",
      },
    },
    itemTypesToSync: {
      type: Array,
      default: [],
    },
    fieldsToSync: {
      type: Array,
      default: fixedShopifyIntegrationFieldsToSync,
      validate: {
        validator: function (value) {
          return fixedShopifyIntegrationFieldsToSync.every((field) =>
            value.includes(field)
          );
        },
        message: "You cannot turn off disabled fields",
      },
    },
    updatedAt: {
      type: Number,
      default: () => Date.now(),
    },
  },
  { _id: false } // Prevents extra _id generation for subdocument
);

const integrationSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: INTEGRATION_DOCUMENT_ID },
  integrations: {
    shopify: { type: shopifySchema, default: {} },
  },
});

integrationSettingsSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() || {};
  const finalUpdate = update?.$set ?? update;

  try {
    if (finalUpdate && finalUpdate["integrations.shopify"]) {
      const shopifyIntegration = finalUpdate["integrations.shopify"];

      if (!shopifyIntegration.isActive) {
        await deleteSession(shopifyIntegration.storeDomain);
      }
    }

    return next();
  } catch (error) {
    console.error("Error updating integration:", error);
    return next(error);
  }
});

const IntegrationSettingsModel = mongoose.model(
  "IntegrationSettings",
  integrationSettingsSchema
);

module.exports = IntegrationSettingsModel;
