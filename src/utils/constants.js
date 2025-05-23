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

const PRODUCT_ARRAY_FILTER_COLUMNS = [
  "supplierName",
  "supplierId",
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

const PRODUCT_DATE_RANGE_FILTER_COLUMNS = ["createdAt", "updatedAt"];

const PRODUCT_TEXT_FILTER_COLUMNS = ["name", "description"];

const VARIANT_TEXT_FILTER_COLUMNS = ["supplierPartNumber", "SKU"];

const VARIANT_ARRAY_FILTER_COLUMNS = [
  "size",
  "color",
  "materialComposition",
  "finish",
];

const VARIANT_DATE_RANGE_FILTER_COLUMNS = ["createdAt", "updatedAt"];

const PRODUCT_AND_VARIANT_ARRAY_COLUMNS = [
  "category",
  "images",
  "docs",
  "variantImages",
  "serialNumber",
  "lotNumber",
  "customsTariffCodes",
  "packagingType",
  "storageRequirements",
  "handlingInstructions",
  "inspectionRequirements",
  "shelfSpaceRequirements",
  "materialComposition",
  "finish",
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

const VARAINT_ARRAY_COLUMNS = [
  "customsTariffCodes",
  "finish",
  "materialComposition",
];

const PRODUCT_OBJECT_COLUMNS = ["countryOfOrigin"];

const VARAINT_OBJECT_COLUMNS = [
  "unitType",
  "stockUnits",
  "purchaseUnits",
  "salesUnits",
];

const SUPPLIER_ARRAY_FILTER_COLUMNS = ["type", "currency", "paymentTerms"];

const SUPPLIER_DATE_RANGE_FILTER_COLUMNS = ["createdAt", "updatedAt"];

const SUPPLIER_TEXT_FILTER_COLUMNS = ["name", "customId", "website"];

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
  "variantId",
  "variantDescription",
  "supplierPartNumber",
  "alternateSupplierPartNumber",
  "supplierPartDescription",
  "alternateSupplierPartDescription",
  "variantImages",
  "SKU",
  "serialNumber",
  "lotNumber",
  "color",
  "size",
  "unitType",
  "autoGenerateUnitTypeBarcode",
  "unitTypebarcodeType",
  "unitTypebarcodeValue",
  "purchaseUnits",
  "isSamePurchaseUnit",
  "purchaseUnitsConversionFactor",
  "purchaseUnitsConversionFactorValue",
  "purchaseUnitsbarcodeType",
  "purchaseUnitsbarcodeValue",
  "isSameSalesUnit",
  "salesUnitsConversionFactor",
  "salesUnitsConversionFactorValue",
  "salesUnitsbarcodeType",
  "salesUnitsbarcodeValue",
  "salesUnits",
  "weight",
  "length",
  "width",
  "height",
  "lengthUnit",
  "weightUnit",
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
  "totalQuantity",
  "cycleCountMethod",
  "cycleCountCategory",
  "cycleCountAutoGenerated",
  "weightCapacity",
  "capacityLength",
  "capacityWidth",
  "capacityHeight",
  "warehouseIds",
  "storageLocations",
  "expiryDate",
  "status",
  "activity",
];

const productLabelsToKeys = {
  "Name*": "name",
  "Description*": "description",
  "Item Type": "itemType1",
  Status: "status",
  "Item ID": "variantId",
  Category: "category",
  "Unit Type*": "unitType",
  "Stock Units*": "stockUnits",
  "Purchase Units*": "purchaseUnits",
  "Sales Units*": "salesUnits",
  "Serial Number Tracking": "serialTracking",
  "Lot Tracking": "lotTracking",
  "Serial Number": "serialNumber",
  "Lot Number": "lotNumber",
  "Item Images": "images",
  "Item Guides & Documents": "docs",
  "Supplier ID*": "supplierId",
  "Supplier Name*": "supplierName",
  "Supplier Part Description*": "supplierPartDescription",
  "Alternate Supplier ID": "alternateSupplierId",
  "Alternate Supplier Name": "alternateSupplierName",
  "Alternate Supplier Part Description": "alternateSupplierPartDescription",
  "Preferred Supplier": "preferredSupplier",
  "Variant Description*": "variantDescription",
  "Supplier Part Number*": "supplierPartNumber",
  "Alternate Supplier Part Number": "alternateSupplierPartNumber",
  "Variant Images": "variantImages",
  SKU: "SKU",
  Color: "color",
  Size: "size",
  Finish: "finish",
  "Weight*": "weight",
  "Length*": "length",
  "Width*": "width",
  "Height*": "height",
  "Purchase Price": "purchasePrice",
  "Selling Price": "sellingPrice",
  "Customs/Tariff Codes": "customsTariffCodes",
  "Lead Time": "leadTime",
  "Minimum Quantity": "minimumQuantity",
  "Maximum Quantity": "maximumQuantity",
  "Safety Stock Level": "safetyStockLevel",
  Quantity: "totalQuantity",
  "Reorder Order Point": "reorderOrderPoint",
  "Reorder Quantity": "reorderQuantity",
  "Minimum Order Quantity": "minimumOrderQuantity",
  "Cycle Count Method": "cycleCountMethod",
  "Cycle Count Category": "cycleCountCategory",
  Barcode: "barcode",
  "Cycle Count Auto generated": "cycleCountAutoGenerated",
  "Packaging Type": "packagingType",
  "Storage Requirements": "storageRequirements",
  "Handling Instructions": "handlingInstructions",
  "Inspection Requirements": "inspectionRequirements",
  "Shelf Space Requirements": "shelfSpaceRequirements",
  "Material Composition": "materialComposition",
  "Customization Options": "customizationOptions",
  "Associated Services": "associatedServices",
  "Safety Information": "safetyInfo",
  "Country of Origin": "countryOfOrigin",
  "Regulatory Compliance": "regulatoryCompliance",
  "Energy Consumption": "energyConsumption",
  "Carbon Footprint": "carbonFootPrint",
  "End-of-Life Disposal Instructions": "endOfLifeDisposal",
  "Warranty Information": "warrantyInformation",
  "Returns Policies": "returnsPolicies",
  "Replacement Parts Information": "replacementPartsInfo",
  "Selling Condition": "sellingConditions",
  Warehouse: "warehouse",
  "Location Name": "customName",
  "Storage Location": "locationName",
  "Maximum Storage Quantity": "maxQtyAtLoc",
  "Expiry Date": "expiryDate",
  "Packaging Supply Type*": "packagingSupplyType",
  "Max Carrying Weight": "weightCapacity",
  "Volume Capacity Length": "capacityLength",
  "Volume Capacity Width": "capacityWidth",
  "Volume Capacity Height": "capacityHeight",
  "Assembly Type*": "kitAssemblyType",
  "Created At": "createdAt",
  "Updated At": "updatedAt",
};

const productKeysToLabels = Object.fromEntries(
  Object.entries(productLabelsToKeys).map(([label, key]) => [
    key,
    label.replace(/\*/g, ""), // remove the * from the labels
  ])
);

const VALID_BARCODE_TYPES = [
  "azteccode",
  "code39",
  "code128",
  "datamatrix",
  "ean8",
  "ean13",
  "gs1-128",
  "interleaved2of5",
  "pdf417",
  "upca",
  "upce",
  "qrcode",
];

const INVENTORY_TRANSACTION_TYPES = {
  PURCHASE_ORDER: "PURCHASE_ORDER",
  SALES_ORDER: "SALES_ORDER",
  INVENTORY_ADJUSTMENT: "INVENTORY_ADJUSTMENT",
  INVENTORY_TRANSFER: "INVENTORY_TRANSFER",
};

const ChartType = {
  LineChart: "Line Chart",
  BarChart: "Bar Chart",
  PieChart: "Pie Chart",
  DonutChart: "Donut Chart",
  Gauge: "Gauge",
  Number: "Number",
  Table: "Table",
};

const DataSource = {
  TimeOnShelf: "Time on shelf",
  SpaceUtilisation: "Space Utilisation",
  TotalInventoryValue: "Total Inventory Value",
  TotalInventoryValuePerCategory: "Total Inventory Value per Category",
};

const ComparedTo = {
  PreviousPeriod: "Previous Period",
  PreviousYear: "Previous Year",
  NoComparison: "No comparison",
};

const ConversionFactor = {
  Multiply: "Multiply",
  Divide: "Divide",
};

const DifferenceStatus = {
  Increase: 0,
  Decrease: 1,
  NoChange: 2,
};

const ChartAggregation = {
  Sum: "Sum",
  Average: "Average",
  Min: "Min",
  Max: "Max",
  Count: "Count",
};

const barChartStyles = {
  borderWidth: 0,
  borderRadius: {
    topLeft: 4,
    topRight: 4,
    bottomLeft: 0,
    bottomRight: 0,
  },
  barThickness: 28,
  maxBarThickness: 34,
};

const pieChartStyles = {
  borderWidth: 1,
};

const randomColors = [
  "#32CD85",
  "#FAA700",
  "#FA6800",
  "#F53939",
  "#D75B95",
  "#745BD7",
  "#1F69FF",
  "#32B8CD",
  "#8B93A7",
  "#84E1B6",
  "#FFCA61",
  "#FFA361",
  "#F98A8A",
  "#E79DBF",
  "#AB9DE7",
  "#7AA7FF",
  "#84D5E1",
  "#B9BECA",
  "#1E7B50",
  "#996600",
  "#943E00",
  "#AF0909",
  "#942458",
  "#3A2494",
  "#003AAD",
  "#1E6F7B",
  "#4F5668",
];

const itemsAtLocationColumns = ["qtyReservedBy"];

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
  productLabelsToKeys,
  productKeysToLabels,
  PRODUCT_AND_VARIANT_ARRAY_COLUMNS,
  VALID_BARCODE_TYPES,
  INVENTORY_TRANSACTION_TYPES,
  ChartType,
  DataSource,
  ComparedTo,
  ConversionFactor,
  barChartStyles,
  DifferenceStatus,
  ChartAggregation,
  randomColors,
  pieChartStyles,
  PRODUCT_ARRAY_FILTER_COLUMNS,
  PRODUCT_DATE_RANGE_FILTER_COLUMNS,
  PRODUCT_TEXT_FILTER_COLUMNS,
  VARIANT_TEXT_FILTER_COLUMNS,
  VARIANT_ARRAY_FILTER_COLUMNS,
  VARIANT_DATE_RANGE_FILTER_COLUMNS,
  itemsAtLocationColumns,
  SUPPLIER_ARRAY_FILTER_COLUMNS,
  SUPPLIER_DATE_RANGE_FILTER_COLUMNS,
  SUPPLIER_TEXT_FILTER_COLUMNS,
};
