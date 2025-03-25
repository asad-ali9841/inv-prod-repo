const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { ITEM_STATUS } = require("../../utils/constants");
const { getWarehouseIdsFromStorageLocations } = require("../../utils");

const baseOptions = {
  discriminatorKey: "itemType", // This will store the item type
  //collection: "items",          // You can keep them all in one collection
};

const ItemSchema = new Schema(
  {
    productId: {
      type: String,
      required: [true, "Product Id is required. Contact support"],
    },
    variantId: {
      type: String,
      unique: true,
      required: true,
    },
    productHasVariants: {
      type: Boolean,
      required: true,
      default: false,
    },
    itemType: {
      type: String,
      required: true,
    },
    sharedAttributes: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ItemShared",
    },
    status: {
      type: String,
      required: true,
      default: ITEM_STATUS.draft,
      enum: Object.values(ITEM_STATUS),
    },

    activity: {
      type: Array,
    },

    createdAt: {
      type: Number,
      default: () => Date.now(), // Default to current UNIX timestamp
      immutable: true,
    },

    updatedAt: {
      type: Number,
      default: () => Date.now(), // Default to current UNIX timestamp
    },
  },
  baseOptions
);

ItemSchema.index(
  { SKU: 1 },
  {
    unique: true,
    partialFilterExpression: {
      SKU: { $exists: true, $type: 'string' },
      status: ITEM_STATUS.active,
    },
  }
);
ItemSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: {
      name: { $exists: true, $type: 'string' },
      status: ITEM_STATUS.active,
    },
  }
);



// Pre-save middleware to update warehouseIds from storageLocations
ItemSchema.pre("save", function (next) {
  this.warehouseIds = getWarehouseIdsFromStorageLocations(
    this.storageLocations
  );

  next();
});

// Add middleware for update operations
ItemSchema.pre(
  ["updateOne", "findOneAndUpdate", "findByIdAndUpdate", "updateMany"],
  async function (next) {
    const update = this.getUpdate();

    // Handle storageLocations update
    if (update?.storageLocations || update?.$set?.storageLocations) {
      const storageLocations =
        update.storageLocations || update.$set.storageLocations;
      const warehouseIds =
        getWarehouseIdsFromStorageLocations(storageLocations);

      if (update.$set) {
        update.$set.warehouseIds = warehouseIds;
      } else {
        update.warehouseIds = warehouseIds;
      }
    }

    // Handle status transitions
    const newStatus = update?.status || update?.$set?.status;
    if (newStatus) {
      // Get current document
      const doc = await this.model.findOne(this.getQuery());
      if (!doc) return next();

      const currentStatus = doc.status;

      // Define valid transitions
      const validTransitions = {
        deactivated: ["draft", "deleted"],
        draft: ["active", "deleted"],
        active: ["draft", "deactivated"],
        deleted: [], // No transitions allowed from deleted
        archived: [], // No transitions allowed from archived
      };

      if (
        currentStatus !== newStatus &&
        !validTransitions[currentStatus]?.includes(newStatus)
      ) {
        return next(
          new Error(`Cannot transition from ${currentStatus} to ${newStatus}`)
        );
      }
    }

    next();
  }
);

ItemSchema.pre("insertMany", function (next, docs) {
  docs.forEach((doc) => {
    if (doc.storageLocations) {
      doc.warehouseIds = getWarehouseIdsFromStorageLocations(
        doc.storageLocations
      );
    }
  });

  next();
});

ItemSchema.pre("bulkWrite", function (next) {
  const operations = this.getOperations();

  operations.forEach((op) => {
    if (op.updateOne || op.updateMany) {
      const update = op.updateOne?.update || op.updateMany?.update;

      if (update?.$set?.storageLocations || update?.storageLocations) {
        const storageLocations =
          update.$set?.storageLocations || update.storageLocations;
        const warehouseIds =
          getWarehouseIdsFromStorageLocations(storageLocations);

        if (update.$set) {
          update.$set.warehouseIds = warehouseIds;
        } else {
          update.warehouseIds = warehouseIds;
        }
      }
    }
  });

  next();
});

const Item = mongoose.model("Item", ItemSchema);
module.exports = Item;
