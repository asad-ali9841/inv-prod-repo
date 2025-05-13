const mongoose = require("mongoose");
const { INVENTORY_TRANSACTION_TYPES } = require("../../utils/constants");

const InventoryLogSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  warehouseId: { type: String },
  transactionType: {
    type: String,
    required: true,
    default: INVENTORY_TRANSACTION_TYPES.SALES_ORDER,
    enum: Object.values(INVENTORY_TRANSACTION_TYPES),
  },
  poId: { type: String },
  soId: { type: String },
  reason: {
    type: String,
    default: "",
  },
  comment: {
    type: String,
    default: "",
  },
  currency: {
    type: String,
    default: "AUD",
  },
  initialQuantity: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: "Initial Quantity must be an integer",
    },
    min: [0, "Initial Quantity cannot be negative"],
  },
  finalQuantity: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: "finalQuantity must be an integer",
    },
    min: [0, "Final Quantity cannot be negative"],
  },
  inventoryValue: {
    type: Number,
    required: true,
  },
  salesValue: {
    type: Number,
  },
  purchaseValue: {
    type: Number,
  },
  createdAt: {
    type: Number,
    default: () => Date.now(),
  },
});

const InventoryLog = mongoose.model("InventoryLog", InventoryLogSchema);
module.exports = InventoryLog;
