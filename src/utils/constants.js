const PRODUCT_ARRAY_COLUMNS = [
  "category",
  "packagingType",
  "storageRequirements",
  "shelfSpaceRequirements",
  "handlingInstructions",
  "inspectionRequirements",
  "customizationOptions",
  "associatedServices",
  "safetyInfo",
  "regulatoryCompliance",
  "energyConsumption",
  "carbonFootPrint",
  "endOfLifeDisposal",
  "warrantyInformation",
  "returnsPolicies",
  "replacementPartsInfo",
  "sellingConditions",
];

const NEW_VARIANT_STATUS_FROM_NEW_PRODUCT_STATUS = {
  active: "active",
  deactivated: "deactivated",
  draft: "draft",
  deleted: "draft",
};

const VARAINT_ARRAY_COLUMNS = ["customsTariffCodes"];

const PRODUCT_OBJECT_COLUMNS = ["countryOfOrigin"];

const VARAINT_OBJECT_COLUMNS = [
  "unitType",
  "stockUnits",
  "purchaseUnits",
  "salesUnits",
];

const SUPPLIER_STATUSES = {
  ACTIVE: "active",
  DEACTIVATED: "deactivated",
  DRAFT: "draft",
  DELETED: "deleted",
};

const SUPPLIER_VALID_STATUS_TRANSITIONS = {
  [SUPPLIER_STATUSES.ACTIVE]: [
    SUPPLIER_STATUSES.DEACTIVATED,
    SUPPLIER_STATUSES.DELETED,
  ],
  [SUPPLIER_STATUSES.DRAFT]: [
    SUPPLIER_STATUSES.DELETED,
    SUPPLIER_STATUSES.ACTIVE,
  ],
  [SUPPLIER_STATUSES.DEACTIVATED]: [
    SUPPLIER_STATUSES.DRAFT,
    SUPPLIER_STATUSES.DELETED,
  ],
  [SUPPLIER_STATUSES.DELETED]: [],
};

const ITEM_STATUS = {
  active: "active",
  deactivated: "deactivated",
  draft: "draft",
  deleted: "deleted",
  archived: "archived",
};

// Be sure to stick with this convention that the common type is generated
// simply by appending 'Common' to the end of the original item type as the
// FE relies on this detail
const ITEM_TYPE = {
  products: "Products",
  productsCommon: "ProductsCommon",
  packagingSupplies: "PackagingSupplies",
  packagingSuppliesCommon: "PackagingSuppliesCommon",
  kits: "Kits",
  kitsCommon: "KitsCommon",
  rawMaterial: "RawMaterials",
  rawMaterialCommon: "RawMaterialsCommon",
  MRO: "Maintenance,Repair,andOperatingSupplies(MRO)",
  MROCommon: "Maintenance,Repair,andOperatingSupplies(MRO)Common",
  nonInventoryItems: "Non-InventoryItems",
  nonInventoryItemsCommon: "Non-InventoryItemsCommon",
  phantomItems: "PhantomItems",
  phantomItemsCommon: "PhantomItemsCommon",
  assembly: "Assembly",
  assemblyCommon: "AssemblyCommon",
};

const PACKAGING_SUPPLY_TYPE = {
  container: "Container",
  packaging: "Packaging",
};
const KIT_ASSEMBLY_TYPE = {
  preAssembled: "Pre-assembled",
  onDemand: "On-demand",
};

const VARIANT_ATTRIBUTES = [
  "variantDescription",
  "variantSupplierPartNumber",
  "variantAlternateSupplierPartNumber",
  "supplierPartDescription",
  "alternateSupplierPartDescription",
  "variantImages",
  "SKU",
  "serialNumber",
  "lotNumber",
  "color",
  "size",
  "unitType",
  "stockUnits",
  "purchaseUnits",
  "salesUnits",
  "weight",
  "length",
  "width",
  "height",
  "purchasePrice",
  "sellingPrice",
  "customsTariffCodes",
  "finish",
  "materialComposition",
  "kitAssemblyType",
  "leadTime",
  "safetyStockLevel",
  "reorderOrderPoint",
  "reorderQuantity",
  "minimumOrderQuantity",
  "cycleCountMethod",
  "cycleCountCategory",
  "cycleCountAutoGenerated",
  "warehouseIds",
  "storageLocations",
  "expiryDate",
];

module.exports = {
  PRODUCT_ARRAY_COLUMNS,
  NEW_VARIANT_STATUS_FROM_NEW_PRODUCT_STATUS,
  VARAINT_ARRAY_COLUMNS,
  PRODUCT_OBJECT_COLUMNS,
  VARAINT_OBJECT_COLUMNS,
  SUPPLIER_STATUSES,
  SUPPLIER_VALID_STATUS_TRANSITIONS,
  ITEM_STATUS,
  ITEM_TYPE,
  PACKAGING_SUPPLY_TYPE,
  KIT_ASSEMBLY_TYPE,
  VARIANT_ATTRIBUTES,
};
