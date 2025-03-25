const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const SupplierModel = require("./Supplier");
const Item = require("./Item");
const ItemShared = require("./ItemSharedAttributes");
const {
  ITEM_TYPE,
  ITEM_STATUS,
  PACKAGING_SUPPLY_TYPE,
  KIT_ASSEMBLY_TYPE,
  SUPPLIER_STATUSES,
} = require("../../utils/constants");

const isNotDraft = function () {
  return this.status !== ITEM_STATUS.draft;
};
const storageLocationSchema = new mongoose.Schema(
  {
    isMain: {
      type: Boolean,
      default: false,
    },
    customName: {
      type: String,
      default: "", // empty or static Main Storage Location
    },
    locationId: {
      type: String,
      default: "",
    },
    locationName: {
      type: String,
      default: "", // name assigned to locations of WHs
    },
    maxQtyAtLoc: {
      type: Number,
      default: 0,
    },
    itemQuantity: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);
const billOfMaterialSchema = new mongoose.Schema(
  {
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    quantity: { type: Number, required: true },
  },
  { _id: false } // This prevents Mongoose from auto-generating an _id field
);
const ProductItemSchema = new Schema({
  // * ITEM IDENTIFICATION
  // Not required - but it should be unique if not empty string
  SKU: {
    type: String,
    //unique: true, // Enforce uniqueness
    //sparse: true, // Ignore null values
    set: (value) => (value == null || value === "" ? undefined : value),
    validate: {
      validator: function (value) {
        // Allow null or enforce format for non-empty SKUs
        return value === null || /^[A-Za-z0-9_-]+$/.test(value);
      },
      message: (props) => `${props.value} is not a valid SKU format!`,
    },
  },
  // Required - not draft
  supplierPartNumber: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Required - not draft
  supplierPartDescription: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required (N-R)
  alternateSupplierPartNumber: {
    type: String,
    default: "",
  },
  // N-R
  alternateSupplierPartDescription: {
    type: String,
    default: "",
  },
  // * UNIT OF MEASURE
  // Required - Not draft
  unitType: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  stockUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  purchaseUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  salesUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // * SIZE & COLOR
  // N-R
  color: {
    type: String,
    default: "",
  },
  // N-R
  size: {
    type: String,
    default: "",
  },

  // * MATERIAL
  // N-R
  materialComposition: {
    type: [String],
    default: [],
  },
  // N-R
  finish: {
    type: [String],
    default: [],
  },
  // * WEIGHT & DIMENSIONS - Required when not draft
  weight: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  length: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  width: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  height: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  lengthUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  weightUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },

  // * STORAGE LOCATIONS
  warehouseIds: {
    type: [String], // or [mongoose.Schema.Types.ObjectId] if warehouseId is an ObjectId
    default: [],
    index: true, // Adds an index for faster queries
  },
  storageLocations: {
    type: Map,
    of: [storageLocationSchema],
    default: {},
  },

  // * PRICING
  purchasePrice: {
    type: Number,
    default: null,
  },

  sellingPrice: {
    type: Number,
    default: null,
  },

  customsTariffCodes: {
    type: [String],
    default: [],
  },

  // *STOCK & REORDER
  leadTime: {
    type: String,
    default: "",
  },
  leadTimeUnit: {
    type: String,
    default: "wks",
  },
  safetyStockLevel: {
    type: Number,
    default: null,
  },
  minimumOrderQuantity: {
    type: Number,
    default: null,
  },
  reorderOrderPoint: {
    type: Number,
    default: null,
  },

  reorderQuantity: {
    type: Number,
    default: null,
  },

  // * COUNTUNG METHOD
  cycleCountMethod: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: true,
  },

  cycleCountAutoGenerated: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },

  cycleCountCategory: {
    type: String,
    enum: ["A", "B", "C", "N/A"],
    required: function () {
      return this.cycleCountMethod && !this.cycleCountAutoGenerated;
    },
    set: function (value) {
      if (this.cycleCountAutoGenerated) {
        return "A";
      }
      if (!this.cycleCountMethod) {
        return "N/A";
      }
      return value;
    },
    validate: {
      validator: function (value) {
        if (!this.cycleCountMethod || this.cycleCountAutoGenerated) return true;
        return value && value.trim().length > 0;
      },
      message:
        "Cycle Count Category is required when Cycle Count is not autogenerated and method is active",
    },
  },
  // * EXTRA ATTRIBUTES FOR MUTIPLE VARIANTS
  // !is the same as product description for single variant case
  variantDescription: {
    type: String,
    required: function () {
      // Fetch the parent product to determine if it has variants
      return this.productHasVariants;
    },
    default: function () {
      return this.productHasVariants ? undefined : "";
    },
    validate: {
      validator: async function (value) {
        if (!this.productHasVariants) return true;
        return value && value.trim().length > 0;
      },
      message: "Variant Description is required when Product has Variants",
    },
  },
  variantImages: {
    type: [String],
    default: [],
  },

  // * FOR BACKEND TRACKING & INFORMATION
  barcode: {
    type: String,
    default: "",
    required: function () {
      return isNotDraft.call(this);
    },
  },

  // * FOR FUTURE // NOT REQUIRED RN
  serialNumber: {
    type: [String],
    default: [],
  },
  lotNumber: {
    type: [String],
    default: [],
  },
});

const ProductItemSchemaCommon = new Schema({
  // Name always required
  name: {
    type: String,
    required: true,
    //unique: true,
  },
  // Required only when not draft
  description: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not required
  category: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    // validate: {
    //   validator: function (value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product category cannot be an empty array",
    // },
  },
  // Not required in draft - assuming a value will always be there
  serialTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  //  Not required in draft - assuming a value will always be there
  lotTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  // Not required
  images: {
    type: [String],
    // required: function() { return isNotDraft.call(this); },
    // validate: {
    //   validator: function(value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product images cannot be empty"
    // }
    default: [],
  },
  // Not required
  docs: {
    type: [String],
    //required: function() { return isNotDraft.call(this); },
    default: [],
  },
  // Required when not draft - Validate that it is a valid Id
  // Supplier Information
  supplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    required: function () {
      return isNotDraft.call(this);
    },
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Required when not draft
  supplierName: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required
  alternateSupplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    default: null,
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        if (!value) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Not Required
  alternateSupplierName: {
    type: String,
    //required: function() { return isNotDraft.call(this); },
    default: "",
  },
  // Not Required
  preferredSupplier: {
    type: String,
    default: "",
  },

  // * STORAGE & HANDLING
  packagingType: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  storageRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  shelfSpaceRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  handlingInstructions: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  inspectionRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  // * ITEM GUIDES & DOCS
  customizationOptions: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  associatedServices: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  safetyInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  countryOfOrigin: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
  },
  // * ENVIRONMENT
  regulatoryCompliance: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  energyConsumption: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  carbonFootPrint: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  endOfLifeDisposal: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },
  // * WARRANTY & SUPPORT
  warrantyInformation: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  returnsPolicies: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  replacementPartsInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  sellingConditions: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },
  currency: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AUD",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AU",
    },
  },

  //* RELATED ITEMS
  relatedItems: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    default: [],
  },
});

const PackagingItemSchema = new Schema({
  // * ITEM IDENTIFICATION
  // Not required - but it should be unique if not empty string
  SKU: {
    type: String,
    //unique: true, // Enforce uniqueness
    //sparse: true, // Ignore null values
    set: (value) => (value == null || value === "" ? undefined : value), // Convert empty strings to null
    validate: {
      validator: function (value) {
        // Allow null or enforce format for non-empty SKUs
        return value === null || /^[A-Za-z0-9_-]+$/.test(value);
      },
      message: (props) => `${props.value} is not a valid SKU format!`,
    },
  },
  // Required - not draft
  supplierPartNumber: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Required - not draft
  supplierPartDescription: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required (N-R)
  alternateSupplierPartNumber: {
    type: String,
    default: "",
  },
  // N-R
  alternateSupplierPartDescription: {
    type: String,
    default: "",
  },
  // * UNIT OF MEASURE
  // Required - Not draft
  unitType: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  stockUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  purchaseUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  salesUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // * SIZE & COLOR
  // N-R
  color: {
    type: String,
    default: "",
  },
  // N-R
  size: {
    type: String,
    default: "",
  },

  // * MATERIAL
  // N-R
  materialComposition: {
    type: [String],
    default: [],
  },
  // N-R
  finish: {
    type: [String],
    default: [],
  },
  // * WEIGHT & DIMENSIONS - Required when not draft
  weight: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  length: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  width: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  height: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  lengthUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  weightUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  // * STORAGE LOCATIONS
  warehouseIds: {
    type: [String], // or [mongoose.Schema.Types.ObjectId] if warehouseId is an ObjectId
    default: [],
    index: true, // Adds an index for faster queries
  },
  storageLocations: {
    type: Map,
    of: [storageLocationSchema],
    default: {},
  },
  // * CAPACITY
  weightCapacity: {
    type: Number,
    default: null,
  },
  capacityLength: {
    type: Number,
    default: null,
  },
  capacityWidth: {
    type: Number,
    default: null,
  },
  capacityHeight: {
    type: Number,
    default: null,
  },

  // * PRICING
  purchasePrice: {
    type: Number,
    default: null,
  },

  sellingPrice: {
    type: Number,
    default: null,
  },

  customsTariffCodes: {
    type: [String],
    default: [],
  },

  // *STOCK & REORDER
  leadTime: {
    type: String,
    default: "",
  },
  leadTimeUnit: {
    type: String,
    default: "wks",
  },
  safetyStockLevel: {
    type: Number,
    default: null,
  },
  minimumOrderQuantity: {
    type: Number,
    default: null,
  },
  reorderOrderPoint: {
    type: Number,
    default: null,
  },

  reorderQuantity: {
    type: Number,
    default: null,
  },

  // * COUNTUNG METHOD
  cycleCountMethod: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: true,
  },

  cycleCountAutoGenerated: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },

  cycleCountCategory: {
    type: String,
    enum: ["A", "B", "C", "N/A"],
    required: function () {
      return this.cycleCountMethod && !this.cycleCountAutoGenerated;
    },
    set: function (value) {
      if (this.cycleCountAutoGenerated) {
        return "A";
      }
      if (!this.cycleCountMethod) {
        return "N/A";
      }
      return value;
    },
    validate: {
      validator: function (value) {
        if (!this.cycleCountMethod || this.cycleCountAutoGenerated) return true;
        return value && value.trim().length > 0;
      },
      message:
        "Cycle Count Category is required when Cycle Count is not autogenerated and method is active",
    },
  },
  // * EXTRA ATTRIBUTES FOR MUTIPLE VARIANTS
  // !is the same as product description for single variant case
  variantDescription: {
    type: String,
    required: function () {
      // Fetch the parent product to determine if it has variants
      return this.productHasVariants;
    },
    default: function () {
      return this.productHasVariants ? undefined : "";
    },
    validate: {
      validator: async function (value) {
        if (!this.productHasVariants) return true;
        return value && value.trim().length > 0;
      },
      message: "Variant Description is required when Product has Variants",
    },
  },
  variantImages: {
    type: [String],
    default: [],
  },

  // * FOR BACKEND TRACKING & INFORMATION
  barcode: {
    type: String,
    default: "",
    required: function () {
      return isNotDraft.call(this);
    },
  },

  // * FOR FUTURE // NOT REQUIRED RN
  serialNumber: {
    type: [String],
    default: [],
  },
  lotNumber: {
    type: [String],
    default: [],
  },
});

const PackagingItemSchemaCommon = new Schema({
  packagingSupplyType: {
    type: String,
    enum: Object.values(PACKAGING_SUPPLY_TYPE),
    required: true,
  },
  // Name always required
  name: {
    type: String,
    required: true,
    //unique: true,
  },
  shortName: {
    type: String,
    default: "",
  },
  // Required only when not draft
  description: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not required
  category: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    // validate: {
    //   validator: function (value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product category cannot be an empty array",
    // },
  },
  // Not required
  images: {
    type: [String],
    // required: function() { return isNotDraft.call(this); },
    // validate: {
    //   validator: function(value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product images cannot be empty"
    // }
    default: [],
  },
  // Not required
  docs: {
    type: [String],
    //required: function() { return isNotDraft.call(this); },
    default: [],
  },
  // Required when not draft - Validate that it is a valid Id
  // Supplier Information
  supplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    required: function () {
      return isNotDraft.call(this);
    },
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Required when not draft
  supplierName: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required
  alternateSupplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    default: null,
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        if (!value) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Not Required
  alternateSupplierName: {
    type: String,
    //required: function() { return isNotDraft.call(this); },
    default: "",
  },
  // Not Required
  preferredSupplier: {
    type: String,
    default: "",
  },

  // * STORAGE & HANDLING
  packagingType: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  storageRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  shelfSpaceRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  handlingInstructions: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  inspectionRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  // * ITEM GUIDES & DOCS

  safetyInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  countryOfOrigin: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
  },
  // * ENVIRONMENT
  regulatoryCompliance: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  energyConsumption: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  carbonFootPrint: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  endOfLifeDisposal: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },
  // * WARRANTY & SUPPORT
  warrantyInformation: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  returnsPolicies: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  replacementPartsInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  currency: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AUD",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AU",
    },
  },

  //* RELATED ITEMS
  relatedItems: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    default: [],
  },
});

const AssemblyItemSchema = new Schema({
  // * ITEM IDENTIFICATION
  // Not required - but it should be unique if not empty string
  SKU: {
    type: String,
    //unique: true, // Enforce uniqueness
    //sparse: true, // Ignore null values
    set: (value) => (value == null || value === "" ? undefined : value), // Convert empty strings to null
    validate: {
      validator: function (value) {
        // Allow null or enforce format for non-empty SKUs
        return value === null || /^[A-Za-z0-9_-]+$/.test(value);
      },
      message: (props) => `${props.value} is not a valid SKU format!`,
    },
  },
  // Required - not draft
  supplierPartNumber: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Required - not draft
  supplierPartDescription: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required (N-R)
  alternateSupplierPartNumber: {
    type: String,
    default: "",
  },
  // N-R
  alternateSupplierPartDescription: {
    type: String,
    default: "",
  },
  // * UNIT OF MEASURE
  // Required - Not draft
  unitType: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  stockUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  purchaseUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  salesUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  //* BILL OF MATERIAL
  billOfMaterial: {
    type: [billOfMaterialSchema],
  },
  // * SIZE & COLOR
  // N-R
  color: {
    type: String,
    default: "",
  },
  // N-R
  size: {
    type: String,
    default: "",
  },

  // * MATERIAL
  // N-R
  materialComposition: {
    type: [String],
    default: [],
  },
  // * WEIGHT & DIMENSIONS - Required when not draft
  weight: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  length: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  width: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  height: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  lengthUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  weightUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  // * STORAGE LOCATIONS
  warehouseIds: {
    type: [String], // or [mongoose.Schema.Types.ObjectId] if warehouseId is an ObjectId
    default: [],
    index: true, // Adds an index for faster queries
  },
  storageLocations: {
    type: Map,
    of: [storageLocationSchema],
    default: {},
  },

  // * PRICING
  purchasePrice: {
    type: Number,
    default: null,
  },

  sellingPrice: {
    type: Number,
    default: null,
  },

  customsTariffCodes: {
    type: [String],
    default: [],
  },

  // *STOCK & REORDER
  leadTime: {
    type: String,
    default: "",
  },
  leadTimeUnit: {
    type: String,
    default: "wks",
  },
  safetyStockLevel: {
    type: Number,
    default: null,
  },
  minimumOrderQuantity: {
    type: Number,
    default: null,
  },
  reorderOrderPoint: {
    type: Number,
    default: null,
  },

  reorderQuantity: {
    type: Number,
    default: null,
  },

  // * COUNTUNG METHOD
  cycleCountMethod: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: true,
  },

  cycleCountAutoGenerated: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },

  cycleCountCategory: {
    type: String,
    enum: ["A", "B", "C", "N/A"],
    required: function () {
      return this.cycleCountMethod && !this.cycleCountAutoGenerated;
    },
    set: function (value) {
      if (this.cycleCountAutoGenerated) {
        return "A";
      }
      if (!this.cycleCountMethod) {
        return "N/A";
      }
      return value;
    },
    validate: {
      validator: function (value) {
        if (!this.cycleCountMethod || this.cycleCountAutoGenerated) return true;
        return value && value.trim().length > 0;
      },
      message:
        "Cycle Count Category is required when Cycle Count is not autogenerated and method is active",
    },
  },
  // * EXTRA ATTRIBUTES FOR MUTIPLE VARIANTS
  // !is the same as product description for single variant case
  variantDescription: {
    type: String,
    required: function () {
      // Fetch the parent product to determine if it has variants
      return this.productHasVariants;
    },
    default: function () {
      return this.productHasVariants ? undefined : "";
    },
    validate: {
      validator: async function (value) {
        if (!this.productHasVariants) return true;
        return value && value.trim().length > 0;
      },
      message: "Variant Description is required when Product has Variants",
    },
  },
  variantImages: {
    type: [String],
    default: [],
  },

  // * FOR BACKEND TRACKING & INFORMATION
  barcode: {
    type: String,
    default: "",
    required: function () {
      return isNotDraft.call(this);
    },
  },

  // * FOR FUTURE // NOT REQUIRED RN
  serialNumber: {
    type: [String],
    default: [],
  },
  lotNumber: {
    type: [String],
    default: [],
  },
});

const AssemblyItemSchemaCommon = new Schema({
  // Name always required
  name: {
    type: String,
    required: true,
    //unique: true,
  },
  // Required only when not draft
  description: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not required
  category: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    // validate: {
    //   validator: function (value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product category cannot be an empty array",
    // },
  },
  // Not required in draft - assuming a value will always be there
  serialTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  //  Not required in draft - assuming a value will always be there
  lotTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  // Not required
  images: {
    type: [String],
    // required: function() { return isNotDraft.call(this); },
    // validate: {
    //   validator: function(value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product images cannot be empty"
    // }
    default: [],
  },
  // Not required
  docs: {
    type: [String],
    //required: function() { return isNotDraft.call(this); },
    default: [],
  },
  // Required when not draft - Validate that it is a valid Id
  // Supplier Information
  supplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    required: function () {
      return isNotDraft.call(this);
    },
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Required when not draft
  supplierName: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required
  alternateSupplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    default: null,
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        if (!value) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Not Required
  alternateSupplierName: {
    type: String,
    //required: function() { return isNotDraft.call(this); },
    default: "",
  },
  // Not Required
  preferredSupplier: {
    type: String,
    default: "",
  },

  // * STORAGE & HANDLING
  packagingType: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  storageRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  shelfSpaceRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  handlingInstructions: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  inspectionRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  // * ITEM GUIDES & DOCS

  safetyInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  countryOfOrigin: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
  },
  // * ENVIRONMENT
  regulatoryCompliance: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  energyConsumption: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  carbonFootPrint: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  endOfLifeDisposal: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },
  // * WARRANTY & SUPPORT
  warrantyInformation: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  returnsPolicies: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  replacementPartsInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  currency: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AUD",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AU",
    },
  },

  //* RELATED ITEMS
  relatedItems: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    default: [],
  },
});

const KitItemSchema = new Schema({
  // * ITEM IDENTIFICATION
  // Not required - but it should be unique if not empty string
  SKU: {
    type: String,
    //unique: true, // Enforce uniqueness
    //sparse: true, // Ignore null values
    set: (value) => (value == null || value === "" ? undefined : value), // Convert empty strings to null
    validate: {
      validator: function (value) {
        // Allow null or enforce format for non-empty SKUs
        return value === null || /^[A-Za-z0-9_-]+$/.test(value);
      },
      message: (props) => `${props.value} is not a valid SKU format!`,
    },
  },
  // Required - not draft
  supplierPartNumber: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Required - not draft
  supplierPartDescription: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required (N-R)
  alternateSupplierPartNumber: {
    type: String,
    default: "",
  },
  // N-R
  alternateSupplierPartDescription: {
    type: String,
    default: "",
  },

  kitAssemblyType: {
    type: String,
    enum: Object.values(KIT_ASSEMBLY_TYPE),
    required: true,
  },
  // * UNIT OF MEASURE
  // Required - Not draft
  unitType: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  stockUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  purchaseUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  salesUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  //* BILL OF MATERIAL
  billOfMaterial: {
    type: [billOfMaterialSchema],
  },
  // * SIZE & COLOR
  // N-R
  color: {
    type: String,
    default: "",
  },
  // N-R
  size: {
    type: String,
    default: "",
  },

  // * MATERIAL
  // N-R
  materialComposition: {
    type: [String],
    default: [],
  },
  // * WEIGHT & DIMENSIONS - Required when not draft
  weight: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  length: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  width: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  height: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  lengthUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  weightUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  // * STORAGE LOCATIONS
  warehouseIds: {
    type: [String], // or [mongoose.Schema.Types.ObjectId] if warehouseId is an ObjectId
    default: [],
    index: true, // Adds an index for faster queries
  },
  storageLocations: {
    type: Map,
    of: [storageLocationSchema],
    default: {},
  },

  // * PRICING
  purchasePrice: {
    type: Number,
    default: null,
  },

  sellingPrice: {
    type: Number,
    default: null,
  },

  customsTariffCodes: {
    type: [String],
    default: [],
  },

  // *STOCK & REORDER
  leadTime: {
    type: String,
    default: "",
  },
  leadTimeUnit: {
    type: String,
    default: "wks",
  },
  safetyStockLevel: {
    type: Number,
    default: null,
  },
  minimumOrderQuantity: {
    type: Number,
    default: null,
  },
  reorderOrderPoint: {
    type: Number,
    default: null,
  },

  reorderQuantity: {
    type: Number,
    default: null,
  },

  // * COUNTUNG METHOD
  cycleCountMethod: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: true,
  },

  cycleCountAutoGenerated: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },

  cycleCountCategory: {
    type: String,
    enum: ["A", "B", "C", "N/A"],
    required: function () {
      return this.cycleCountMethod && !this.cycleCountAutoGenerated;
    },
    set: function (value) {
      if (this.cycleCountAutoGenerated) {
        return "A";
      }
      if (!this.cycleCountMethod) {
        return "N/A";
      }
      return value;
    },
    validate: {
      validator: function (value) {
        if (!this.cycleCountMethod || this.cycleCountAutoGenerated) return true;
        return value && value.trim().length > 0;
      },
      message:
        "Cycle Count Category is required when Cycle Count is not autogenerated and method is active",
    },
  },
  // * EXTRA ATTRIBUTES FOR MUTIPLE VARIANTS
  // !is the same as product description for single variant case
  variantDescription: {
    type: String,
    required: function () {
      // Fetch the parent product to determine if it has variants
      return this.productHasVariants;
    },
    default: function () {
      return this.productHasVariants ? undefined : "";
    },
    validate: {
      validator: async function (value) {
        if (!this.productHasVariants) return true;
        return value && value.trim().length > 0;
      },
      message: "Variant Description is required when Product has Variants",
    },
  },
  variantImages: {
    type: [String],
    default: [],
  },

  // * FOR BACKEND TRACKING & INFORMATION
  barcode: {
    type: String,
    default: "",
    required: function () {
      return isNotDraft.call(this);
    },
  },

  // * FOR FUTURE // NOT REQUIRED RN
  serialNumber: {
    type: [String],
    default: [],
  },
  lotNumber: {
    type: [String],
    default: [],
  },
});

const KitItemSchemaCommon = new Schema({
  // Name always required
  name: {
    type: String,
    required: true,
    //unique: true,
  },
  // Required only when not draft
  description: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not required
  category: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    // validate: {
    //   validator: function (value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product category cannot be an empty array",
    // },
  },
  // Not required in draft - assuming a value will always be there
  serialTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  //  Not required in draft - assuming a value will always be there
  lotTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  // Not required
  images: {
    type: [String],
    // required: function() { return isNotDraft.call(this); },
    // validate: {
    //   validator: function(value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product images cannot be empty"
    // }
    default: [],
  },
  // Not required
  docs: {
    type: [String],
    //required: function() { return isNotDraft.call(this); },
    default: [],
  },
  // Required when not draft - Validate that it is a valid Id
  // Supplier Information
  supplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    required: function () {
      return isNotDraft.call(this);
    },
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Required when not draft
  supplierName: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required
  alternateSupplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    default: null,
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        if (!value) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Not Required
  alternateSupplierName: {
    type: String,
    //required: function() { return isNotDraft.call(this); },
    default: "",
  },
  // Not Required
  preferredSupplier: {
    type: String,
    default: "",
  },

  // * STORAGE & HANDLING
  packagingType: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  storageRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  shelfSpaceRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  handlingInstructions: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  inspectionRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  // * ITEM GUIDES & DOCS
  safetyInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  countryOfOrigin: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
  },
  // * ENVIRONMENT
  regulatoryCompliance: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  energyConsumption: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  carbonFootPrint: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  endOfLifeDisposal: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },
  // * WARRANTY & SUPPORT
  warrantyInformation: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  returnsPolicies: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  replacementPartsInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  currency: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AUD",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AU",
    },
  },

  //* RELATED ITEMS
  relatedItems: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    default: [],
  },
});

const MROItemSchema = new Schema({
  // * ITEM IDENTIFICATION
  // Not required - but it should be unique if not empty string
  SKU: {
    type: String,
    //unique: true, // Enforce uniqueness
    //sparse: true, // Ignore null values
    set: (value) => (value == null || value === "" ? undefined : value), // Convert empty strings to null
    validate: {
      validator: function (value) {
        // Allow null or enforce format for non-empty SKUs
        return value === null || /^[A-Za-z0-9_-]+$/.test(value);
      },
      message: (props) => `${props.value} is not a valid SKU format!`,
    },
  },
  // Required - not draft
  supplierPartNumber: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Required - not draft
  supplierPartDescription: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required (N-R)
  alternateSupplierPartNumber: {
    type: String,
    default: "",
  },
  // N-R
  alternateSupplierPartDescription: {
    type: String,
    default: "",
  },
  // * UNIT OF MEASURE
  // Required - Not draft
  unitType: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  stockUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  purchaseUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  salesUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // * SIZE & COLOR
  // N-R
  color: {
    type: String,
    default: "",
  },
  // N-R
  size: {
    type: String,
    default: "",
  },

  // * MATERIAL
  // N-R
  materialComposition: {
    type: [String],
    default: [],
  },
  // N-R
  finish: {
    type: [String],
    default: [],
  },
  // * WEIGHT & DIMENSIONS - Required when not draft
  weight: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  length: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  width: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  height: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  lengthUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  weightUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  // * STORAGE LOCATIONS
  warehouseIds: {
    type: [String], // or [mongoose.Schema.Types.ObjectId] if warehouseId is an ObjectId
    default: [],
    index: true, // Adds an index for faster queries
  },
  storageLocations: {
    type: Map,
    of: [storageLocationSchema],
    default: {},
  },
  // * PRICING
  purchasePrice: {
    type: Number,
    default: null,
  },

  sellingPrice: {
    type: Number,
    default: null,
  },

  customsTariffCodes: {
    type: [String],
    default: [],
  },

  // *STOCK & REORDER
  leadTime: {
    type: String,
    default: "",
  },
  leadTimeUnit: {
    type: String,
    default: "wks",
  },
  safetyStockLevel: {
    type: Number,
    default: null,
  },
  minimumOrderQuantity: {
    type: Number,
    default: null,
  },
  reorderOrderPoint: {
    type: Number,
    default: null,
  },

  reorderQuantity: {
    type: Number,
    default: null,
  },

  // * COUNTUNG METHOD
  cycleCountMethod: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: true,
  },

  cycleCountAutoGenerated: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },

  cycleCountCategory: {
    type: String,
    enum: ["A", "B", "C", "N/A"],
    required: function () {
      return this.cycleCountMethod && !this.cycleCountAutoGenerated;
    },
    set: function (value) {
      if (this.cycleCountAutoGenerated) {
        return "A";
      }
      if (!this.cycleCountMethod) {
        return "N/A";
      }
      return value;
    },
    validate: {
      validator: function (value) {
        if (!this.cycleCountMethod || this.cycleCountAutoGenerated) return true;
        return value && value.trim().length > 0;
      },
      message:
        "Cycle Count Category is required when Cycle Count is not autogenerated and method is active",
    },
  },
  // * EXTRA ATTRIBUTES FOR MUTIPLE VARIANTS
  // !is the same as product description for single variant case
  variantDescription: {
    type: String,
    required: function () {
      // Fetch the parent product to determine if it has variants
      return this.productHasVariants;
    },
    default: function () {
      return this.productHasVariants ? undefined : "";
    },
    validate: {
      validator: async function (value) {
        if (!this.productHasVariants) return true;
        return value && value.trim().length > 0;
      },
      message: "Variant Description is required when Product has Variants",
    },
  },
  variantImages: {
    type: [String],
    default: [],
  },

  // * FOR BACKEND TRACKING & INFORMATION
  barcode: {
    type: String,
    default: "",
    required: function () {
      return isNotDraft.call(this);
    },
  },

  // * FOR FUTURE // NOT REQUIRED RN
  serialNumber: {
    type: [String],
    default: [],
  },
  lotNumber: {
    type: [String],
    default: [],
  },
});

const MROItemSchemaCommon = new Schema({
  // Name always required
  name: {
    type: String,
    required: true,
    //unique: true,
  },
  // Required only when not draft
  description: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not required
  category: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    // validate: {
    //   validator: function (value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product category cannot be an empty array",
    // },
  },
  // Not required in draft - assuming a value will always be there
  serialTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  //  Not required in draft - assuming a value will always be there
  lotTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  // Not required
  images: {
    type: [String],
    // required: function() { return isNotDraft.call(this); },
    // validate: {
    //   validator: function(value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product images cannot be empty"
    // }
    default: [],
  },
  // Not required
  docs: {
    type: [String],
    //required: function() { return isNotDraft.call(this); },
    default: [],
  },
  // Required when not draft - Validate that it is a valid Id
  // Supplier Information
  supplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    required: function () {
      return isNotDraft.call(this);
    },
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Required when not draft
  supplierName: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required
  alternateSupplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    default: null,
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        if (!value) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Not Required
  alternateSupplierName: {
    type: String,
    //required: function() { return isNotDraft.call(this); },
    default: "",
  },
  // Not Required
  preferredSupplier: {
    type: String,
    default: "",
  },

  // * STORAGE & HANDLING
  packagingType: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  // * ITEM GUIDES & DOCS
  safetyInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  countryOfOrigin: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
  },
  // * ENVIRONMENT

  endOfLifeDisposal: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },
  // * WARRANTY & SUPPORT
  warrantyInformation: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  returnsPolicies: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  replacementPartsInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },
  currency: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AUD",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AU",
    },
  },

  //* RELATED ITEMS
  relatedItems: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    default: [],
  },
});

const RawMaterialItemSchema = new Schema({
  // * ITEM IDENTIFICATION
  // Not required - but it should be unique if not empty string
  SKU: {
    type: String,
    //unique: true, // Enforce uniqueness
    //sparse: true, // Ignore null values
    set: (value) => (value == null || value === "" ? undefined : value), // Convert empty strings to null
    validate: {
      validator: function (value) {
        // Allow null or enforce format for non-empty SKUs
        return value === null || /^[A-Za-z0-9_-]+$/.test(value);
      },
      message: (props) => `${props.value} is not a valid SKU format!`,
    },
  },
  // Required - not draft
  supplierPartNumber: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Required - not draft
  supplierPartDescription: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required (N-R)
  alternateSupplierPartNumber: {
    type: String,
    default: "",
  },
  // N-R
  alternateSupplierPartDescription: {
    type: String,
    default: "",
  },
  // * UNIT OF MEASURE
  // Required - Not draft
  unitType: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  stockUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  purchaseUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  salesUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // * SIZE & COLOR
  // N-R
  color: {
    type: String,
    default: "",
  },
  // N-R
  size: {
    type: String,
    default: "",
  },

  // * MATERIAL
  // N-R
  materialComposition: {
    type: [String],
    default: [],
  },
  // N-R
  finish: {
    type: [String],
    default: [],
  },
  // * WEIGHT & DIMENSIONS - Required when not draft
  weight: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  length: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  width: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  height: {
    type: Number,
    required: function () {
      return isNotDraft.call(this);
    },
    default: null,
  },

  lengthUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  weightUnit: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
    default: "cm",
  },
  // * STORAGE LOCATIONS
  warehouseIds: {
    type: [String], // or [mongoose.Schema.Types.ObjectId] if warehouseId is an ObjectId
    default: [],
    index: true, // Adds an index for faster queries
  },
  storageLocations: {
    type: Map,
    of: [storageLocationSchema],
    default: {},
  },
  // * PRICING
  purchasePrice: {
    type: Number,
    default: null,
  },

  sellingPrice: {
    type: Number,
    default: null,
  },

  customsTariffCodes: {
    type: [String],
    default: [],
  },

  // *STOCK & REORDER
  leadTime: {
    type: String,
    default: "",
  },
  leadTimeUnit: {
    type: String,
    default: "wks",
  },
  safetyStockLevel: {
    type: Number,
    default: null,
  },
  minimumOrderQuantity: {
    type: Number,
    default: null,
  },
  reorderOrderPoint: {
    type: Number,
    default: null,
  },

  reorderQuantity: {
    type: Number,
    default: null,
  },

  // * COUNTUNG METHOD
  cycleCountMethod: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: true,
  },

  cycleCountAutoGenerated: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },

  cycleCountCategory: {
    type: String,
    enum: ["A", "B", "C", "N/A"],
    required: function () {
      return this.cycleCountMethod && !this.cycleCountAutoGenerated;
    },
    set: function (value) {
      if (this.cycleCountAutoGenerated) {
        return "A";
      }
      if (!this.cycleCountMethod) {
        return "N/A";
      }
      return value;
    },
    validate: {
      validator: function (value) {
        if (!this.cycleCountMethod || this.cycleCountAutoGenerated) return true;
        return value && value.trim().length > 0;
      },
      message:
        "Cycle Count Category is required when Cycle Count is not autogenerated and method is active",
    },
  },
  // * EXTRA ATTRIBUTES FOR MUTIPLE VARIANTS
  // !is the same as product description for single variant case
  variantDescription: {
    type: String,
    required: function () {
      // Fetch the parent product to determine if it has variants
      return this.productHasVariants;
    },
    default: function () {
      return this.productHasVariants ? undefined : "";
    },
    validate: {
      validator: async function (value) {
        if (!this.productHasVariants) return true;
        return value && value.trim().length > 0;
      },
      message: "Variant Description is required when Product has Variants",
    },
  },
  variantImages: {
    type: [String],
    default: [],
  },

  // * FOR BACKEND TRACKING & INFORMATION
  barcode: {
    type: String,
    default: "",
    required: function () {
      return isNotDraft.call(this);
    },
  },

  // * FOR FUTURE // NOT REQUIRED RN
  serialNumber: {
    type: [String],
    default: [],
  },
  lotNumber: {
    type: [String],
    default: [],
  },
});

const RawMaterialItemSchemaCommon = new Schema({
  // Name always required
  name: {
    type: String,
    required: true,
    //unique: true,
  },
  // Required only when not draft
  description: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not required
  category: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    // validate: {
    //   validator: function (value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product category cannot be an empty array",
    // },
  },
  //  Not required in draft - assuming a value will always be there
  lotTracking: {
    type: Boolean,
    required: function () {
      return isNotDraft.call(this);
    },
    default: false,
  },
  // Not required
  images: {
    type: [String],
    // required: function() { return isNotDraft.call(this); },
    // validate: {
    //   validator: function(value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product images cannot be empty"
    // }
    default: [],
  },
  // Not required
  docs: {
    type: [String],
    //required: function() { return isNotDraft.call(this); },
    default: [],
  },
  // Required when not draft - Validate that it is a valid Id
  // Supplier Information
  supplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    required: function () {
      return isNotDraft.call(this);
    },
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Required when not draft
  supplierName: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required
  alternateSupplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    default: null,
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        if (!value) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Not Required
  alternateSupplierName: {
    type: String,
    //required: function() { return isNotDraft.call(this); },
    default: "",
  },
  // Not Required
  preferredSupplier: {
    type: String,
    default: "",
  },

  // * STORAGE & HANDLING
  packagingType: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  storageRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  shelfSpaceRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  handlingInstructions: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  inspectionRequirements: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  // * ITEM GUIDES & DOCS
  safetyInfo: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  countryOfOrigin: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "",
    },
  },
  // * ENVIRONMENT
  regulatoryCompliance: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  energyConsumption: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  carbonFootPrint: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  endOfLifeDisposal: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },
  // * WARRANTY & SUPPORT
  warrantyInformation: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  returnsPolicies: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  currency: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AUD",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AU",
    },
  },
});

const NonInventoryItemSchema = new Schema({
  // * ITEM IDENTIFICATION
  // Not required - but it should be unique if not empty string
  SKU: {
    type: String,
    //unique: true, // Enforce uniqueness
    //sparse: true, // Ignore null values
    set: (value) => (value == null || value === "" ? undefined : value), // Convert empty strings to null
    validate: {
      validator: function (value) {
        // Allow null or enforce format for non-empty SKUs
        return value === null || /^[A-Za-z0-9_-]+$/.test(value);
      },
      message: (props) => `${props.value} is not a valid SKU format!`,
    },
  },
  // Required - not draft
  supplierPartNumber: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Required - not draft
  supplierPartDescription: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required (N-R)
  alternateSupplierPartNumber: {
    type: String,
    default: "",
  },
  // N-R
  alternateSupplierPartDescription: {
    type: String,
    default: "",
  },
  // * UNIT OF MEASURE
  // Required - Not draft
  unitType: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  stockUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  purchaseUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // Required - Not draft
  salesUnits: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },

  // * PRICING
  purchasePrice: {
    type: Number,
    default: null,
  },

  sellingPrice: {
    type: Number,
    default: null,
  },

  // * EXTRA ATTRIBUTES FOR MUTIPLE VARIANTS
  // !is the same as product description for single variant case
  variantDescription: {
    type: String,
    required: function () {
      // Fetch the parent product to determine if it has variants
      return this.productHasVariants;
    },
    default: function () {
      return this.productHasVariants ? undefined : "";
    },
    validate: {
      validator: async function (value) {
        if (!this.productHasVariants) return true;
        return value && value.trim().length > 0;
      },
      message: "Variant Description is required when Product has Variants",
    },
  },
  variantImages: {
    type: [String],
    default: [],
  },

  // * FOR BACKEND TRACKING & INFORMATION
  barcode: {
    type: String,
    default: "",
    required: function () {
      return isNotDraft.call(this);
    },
  },
});

const NonInventoryItemSchemaCommon = new Schema({
  // Name always required
  name: {
    type: String,
    required: true,
    //unique: true,
  },
  // Required only when not draft
  description: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not required
  category: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    // validate: {
    //   validator: function (value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product category cannot be an empty array",
    // },
  },

  // Required when not draft - Validate that it is a valid Id
  // Supplier Information
  supplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    required: function () {
      return isNotDraft.call(this);
    },
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Required when not draft
  supplierName: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not Required
  alternateSupplierId: {
    type: String,
    ref: "Supplier", // Reference the Supplier model
    default: null,
    validate: {
      validator: async function (value) {
        if (!isNotDraft.call(this)) return true;
        if (!value) return true;
        const supplier = await SupplierModel.findOne({
          customId: value,
          status: SUPPLIER_STATUSES.ACTIVE,
        });
        return Boolean(supplier); // Ensure the supplier with this customId exists
      },
      message: (props) =>
        `Active supplier with customId ${props.value} does not exist`,
    },
  },
  // Not Required
  alternateSupplierName: {
    type: String,
    //required: function() { return isNotDraft.call(this); },
    default: "",
  },
  // Not Required
  preferredSupplier: {
    type: String,
    default: "",
  },

  // * STORAGE & HANDLING

  // * ITEM GUIDES & DOCS
  customizationOptions: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  associatedServices: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    default: [],
  },

  currency: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AUD",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AU",
    },
  },
});

const PhantomItemSchema = new Schema({
  // * ITEM IDENTIFICATION
  // Not required - but it should be unique if not empty string
  SKU: {
    type: String,
    //unique: true, // Enforce uniqueness
    //sparse: true, // Ignore null values
    set: (value) => (value == null || value === "" ? undefined : value), // Convert empty strings to null
    validate: {
      validator: function (value) {
        // Allow null or enforce format for non-empty SKUs
        return value === null || /^[A-Za-z0-9_-]+$/.test(value);
      },
      message: (props) => `${props.value} is not a valid SKU format!`,
    },
  },
  // * UNIT OF MEASURE
  // Required - Not draft
  unitType: {
    label: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
    value: {
      type: String,
      required: function () {
        return isNotDraft.call(this);
      },
    },
  },
  // * EXTRA ATTRIBUTES FOR MUTIPLE VARIANTS
  // !is the same as product description for single variant case
  variantDescription: {
    type: String,
    required: function () {
      // Fetch the parent product to determine if it has variants
      return this.productHasVariants;
    },
    default: function () {
      return this.productHasVariants ? undefined : "";
    },
    validate: {
      validator: async function (value) {
        if (!this.productHasVariants) return true;
        return value && value.trim().length > 0;
      },
      message: "Variant Description is required when Product has Variants",
    },
  },
  variantImages: {
    type: [String],
    default: [],
  },

  // * FOR BACKEND TRACKING & INFORMATION
  barcode: {
    type: String,
    default: "",
    required: function () {
      return isNotDraft.call(this);
    },
  },
});

const PhantomItemSchemaCommon = new Schema({
  // Name always required
  name: {
    type: String,
    required: true,
    //unique: true,
  },
  // Required only when not draft
  description: {
    type: String,
    required: function () {
      return isNotDraft.call(this);
    },
  },
  // Not required
  category: {
    type: [String],
    // required: function () {
    //   return isNotDraft.call(this);
    // },
    // validate: {
    //   validator: function (value) {
    //     if (!isNotDraft.call(this)) return true;
    //     return value.length > 0; // Ensure array is not empty
    //   },
    //   message: "Product category cannot be an empty array",
    // },
  },
  currency: {
    label: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AUD",
    },
    value: {
      type: String,
      //   required: function () {
      //     return isNotDraft.call(this);
      //   },
      default: "AU",
    },
  },
});

const Products = Item.discriminator(ITEM_TYPE.products, ProductItemSchema);
const ProductsCommon = ItemShared.discriminator(
  ITEM_TYPE.productsCommon.replace(/\s+/g, ""),
  ProductItemSchemaCommon
);

const PackagingSupplies = Item.discriminator(
  ITEM_TYPE.packagingSupplies,
  PackagingItemSchema
);
const PackagingSuppliesCommon = ItemShared.discriminator(
  ITEM_TYPE.packagingSuppliesCommon.replace(/\s+/g, ""),
  PackagingItemSchemaCommon
);

const Assembly = Item.discriminator(ITEM_TYPE.assembly, AssemblyItemSchema);
const AssemblyCommon = ItemShared.discriminator(
  ITEM_TYPE.assemblyCommon.replace(/\s+/g, ""),
  AssemblyItemSchemaCommon
);

const Kit = Item.discriminator(ITEM_TYPE.kits, KitItemSchema);
const KitCommon = ItemShared.discriminator(
  ITEM_TYPE.kitsCommon.replace(/\s+/g, ""),
  KitItemSchemaCommon
);

const MRO = Item.discriminator(ITEM_TYPE.MRO, MROItemSchema);
const MROCommon = ItemShared.discriminator(
  ITEM_TYPE.MROCommon.replace(/\s+/g, ""),
  MROItemSchemaCommon
);

const RawMaterial = Item.discriminator(
  ITEM_TYPE.rawMaterial,
  RawMaterialItemSchema
);
const RawMaterialCommon = ItemShared.discriminator(
  ITEM_TYPE.rawMaterialCommon.replace(/\s+/g, ""),
  RawMaterialItemSchemaCommon
);

const NonInventory = Item.discriminator(
  ITEM_TYPE.nonInventoryItems,
  NonInventoryItemSchema
);

const NonInventoryCommon = ItemShared.discriminator(
  ITEM_TYPE.nonInventoryItemsCommon.replace(/\s+/g, ""),
  NonInventoryItemSchemaCommon
);

const Phantom = Item.discriminator(ITEM_TYPE.phantomItems, PhantomItemSchema);

const PhantomCommon = ItemShared.discriminator(
  ITEM_TYPE.phantomItemsCommon.replace(/\s+/g, ""),
  PhantomItemSchemaCommon
);

module.exports = {
  Products,
  ProductsCommon,
  PackagingSupplies,
  PackagingSuppliesCommon,
  Assembly,
  AssemblyCommon,
  Kit,
  KitCommon,
  MRO,
  MROCommon,
  RawMaterial,
  RawMaterialCommon,
  NonInventory,
  NonInventoryCommon,
  Phantom,
  PhantomCommon,
};
