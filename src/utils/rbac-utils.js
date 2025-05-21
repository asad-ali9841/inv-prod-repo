const INVENTORY_SERVICE_URLS = {
  // Shopify routes
  SHOPIFY_AUTH: "/shopify/auth",
  SHOPIFY_AUTH_CALLBACK: "/shopify/auth/callback",
  SHOPIFY_APP: "/shopify/app",

  // Product attributes
  GET_PRODUCT_ATTRIBUTES: "/product/getattributes",
  UPDATE_PRODUCT_ATTRIBUTES: "/product/updateattributes",

  // Image management
  GET_IMAGE_URL: "/product/getimageurl",
  GET_IMAGE_DOWNLOAD_URL: "/product/getimagedownloadurl",
  DELETE_IMAGE: "/product/deleteimage",

  // Product management v3
  ADD_PRODUCT: "/product/add/v3",
  GET_ALL_PRODUCTS: "/product/getall/v3",
  GET_PRODUCT_BY_ID: "/product/getbyid/v3",
  UPDATE_PRODUCT: "/product/update/v3",
  UPDATE_PRODUCT_STATUS: "/product/status/update/v3",
  DELETE_PRODUCT: "/product/delete/v3",
  ADD_BULK_PRODUCTS: "/product/addbulk/v3",
  DUPLICATE_PRODUCT: "/product/duplicate/v3",
  SEARCH_PRODUCTS: "/product/getlist/search/v3",
  DOWNLOAD_ALL: "/download/all/v3",
  GET_PRODUCTS_BY_QUERY: "/product/getall/byquery/v3",

  // Item list management
  GET_ITEM_LIST: "/itemlist",
  ADD_NEW_LIST: "/addnewlist",
  GET_ALL_LIST_KEYS: "/getalllistkeys",
  GET_ALL_LISTS: "/getalllists",
  ADD_ITEM_TO_LIST: "/additemtolist",
  CHANGE_LIST_STATUS: "/changestatusoflist",
  UPDATE_LIST: "/updatelist",

  // Supplier management
  ADD_SUPPLIER: "/supplier/add",
  ADD_BULK_SUPPLIERS: "/supplier/addbulk",
  GET_ALL_SUPPLIERS: "/supplier/getall",
  GET_SUPPLIER_BY_ID: "/supplier/getbyid",
  GET_SUPPLIER_BY_ID_OPEN: "/supplier/getbyid/open",
  SEARCH_SUPPLIERS: "/supplier/search",
  UPDATE_SUPPLIER: "/supplier/update",
  UPDATE_SUPPLIER_STATUS: "/supplier/update/status",
  DELETE_SUPPLIER: "/supplier/delete",
  UPDATE_BULK_SUPPLIERS: "/supplier/updatebulk",
  GET_SUPPLIERS_BY_IDS: "/supplier/getall/ids",
  SEARCH_ALL_SUPPLIERS: "/supplier/getlist/search",

  // ABC Class management
  ADD_ABC_CLASS: "/abcclass/add",
  GET_ALL_ABC_CLASSES: "/abcclass/getall",
  GET_ABC_CLASS_BY_ID: "/abcclass/getbyid",
  UPDATE_ABC_CLASS: "/abcclass/update",
  UPDATE_ABC_CLASS_STATUS: "/abcclass/update/status",
  DELETE_ABC_CLASS: "/abcclass/delete",
  UPDATE_BULK_ABC_CLASSES: "/abcclass/updatebulk",

  // Legacy endpoints
  GET_MANY_PRODUCTS_BY_ID: "/product/getmanybyid",
  GET_MANY_PRODUCTS_BY_VID: "/product/getmanybyvid",
  GET_ONE_BY_VID: "/product/getonebyvid",
  UPDATE_VARIANT_STATUS: "/variant/status/update",
  DUPLICATE_VARIANT: "/variant/duplicate",
  DELETE_VARIANT: "/variant/delete",
  INVENTORY_ADJUSTMENT: "/variant/inventoryadjustment",
  INVENTORY_TRANSFER: "/variant/inventorytransfer",
  GET_CHART_DATA: "/getchartdata",
  UPDATE_ITEM_QUANTITY_PUTAWAY: "/update/itemquantity/putaway",
  UPDATE_ITEM_QUANTITY_PICKING: "/update/itemquantity/picking",

  // Integration management
  GET_ACTIVE_INTEGRATIONS: "/integration/getactive",
  GET_INTEGRATION: "/integration/get",
  GET_INTEGRATION_OPEN: "/integration/get/open",
  UPDATE_INTEGRATION: "/integration/update",
  VALIDATE_SHOPIFY_STORE: "/integration/validateshopifystore",
};

const URL_TO_ROLE_KEY_LOOKUP = {
  // Shopify routes
  [INVENTORY_SERVICE_URLS.SHOPIFY_AUTH]: true,
  [INVENTORY_SERVICE_URLS.SHOPIFY_AUTH_CALLBACK]: true,
  [INVENTORY_SERVICE_URLS.SHOPIFY_APP]: true,

  // Product attributes
  [INVENTORY_SERVICE_URLS.GET_PRODUCT_ATTRIBUTES]:
    "Settings_Page__Customizations",
  [INVENTORY_SERVICE_URLS.UPDATE_PRODUCT_ATTRIBUTES]:
    "Settings_Page__Customizations",

  // Image management
  [INVENTORY_SERVICE_URLS.GET_IMAGE_URL]: [
    {
      roleKey: "Settings_Page__Items",
      action: "create",
    },
    // add mobile as well
  ],
  [INVENTORY_SERVICE_URLS.GET_IMAGE_DOWNLOAD_URL]: true,
  [INVENTORY_SERVICE_URLS.DELETE_IMAGE]: [
    {
      roleKey: "Settings_Page__Items",
      action: "create",
    },
    // add mobile as well
  ],

  // Product management v3
  [INVENTORY_SERVICE_URLS.ADD_PRODUCT]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.GET_ALL_PRODUCTS]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.GET_PRODUCT_BY_ID]: [
    {
      roleKey: "Settings_Page__Items",
      action: "read",
    },
    {
      roleKey: "Inventory_Page__Items_List",
      action: "read",
    },
    // add mobile as well
  ],
  [INVENTORY_SERVICE_URLS.UPDATE_PRODUCT]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.UPDATE_PRODUCT_STATUS]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.DELETE_PRODUCT]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.ADD_BULK_PRODUCTS]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.DUPLICATE_PRODUCT]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.SEARCH_PRODUCTS]: true,
  [INVENTORY_SERVICE_URLS.DOWNLOAD_ALL]: true,
  [INVENTORY_SERVICE_URLS.GET_PRODUCTS_BY_QUERY]: [
    {
      roleKey: "Settings_Page__Items",
      action: "read",
    },
    {
      roleKey: "Inventory_Page__Items_List",
      action: "read",
    },
    // add mobile as well
  ],

  // Item list management
  [INVENTORY_SERVICE_URLS.GET_ITEM_LIST]: "Inventory_Page__Items_List",
  [INVENTORY_SERVICE_URLS.ADD_NEW_LIST]: "Settings_Page__Customizations",
  [INVENTORY_SERVICE_URLS.GET_ALL_LIST_KEYS]: [
    {
      roleKey: "Settings_Page__Items",
      action: "create",
    },
    {
      roleKey: "Settings_Page__Customizations",
      action: "create",
    },
  ],
  [INVENTORY_SERVICE_URLS.GET_ALL_LISTS]: [
    {
      roleKey: "Settings_Page__Items",
      action: "create",
    },
    {
      roleKey: "Settings_Page__Customizations",
      action: "create",
    },
  ],
  [INVENTORY_SERVICE_URLS.ADD_ITEM_TO_LIST]: [
    {
      roleKey: "Settings_Page__Items",
      action: "create",
    },
    {
      roleKey: "Settings_Page__Customizations",
      action: "create",
    },
  ],
  [INVENTORY_SERVICE_URLS.CHANGE_LIST_STATUS]: "Settings_Page__Customizations",
  [INVENTORY_SERVICE_URLS.UPDATE_LIST]: [
    {
      roleKey: "Settings_Page__Items",
      action: "create",
    },
    {
      roleKey: "Settings_Page__Customizations",
      action: "create",
    },
  ],

  // Supplier management
  [INVENTORY_SERVICE_URLS.ADD_SUPPLIER]: "Settings_Page__Suppliers",
  [INVENTORY_SERVICE_URLS.ADD_BULK_SUPPLIERS]:
    "Settings_Page__Suppliers__Import_or_Export",
  [INVENTORY_SERVICE_URLS.GET_ALL_SUPPLIERS]: "Settings_Page__Suppliers",
  [INVENTORY_SERVICE_URLS.GET_SUPPLIER_BY_ID]: "Settings_Page__Suppliers",
  [INVENTORY_SERVICE_URLS.GET_SUPPLIER_BY_ID_OPEN]: true,
  [INVENTORY_SERVICE_URLS.SEARCH_SUPPLIERS]: [
    {
      roleKey: "Settings_Page__Suppliers",
      action: "read",
    },
    {
      roleKey: "Settings_Page__Items",
      action: "read",
    },
    {
      roleKey: "Orders_Page__Purchase_Orders",
      action: "read",
    },
  ],
  [INVENTORY_SERVICE_URLS.UPDATE_SUPPLIER]: "Settings_Page__Suppliers",
  [INVENTORY_SERVICE_URLS.UPDATE_SUPPLIER_STATUS]: "Settings_Page__Suppliers",
  [INVENTORY_SERVICE_URLS.DELETE_SUPPLIER]: "Settings_Page__Suppliers",
  [INVENTORY_SERVICE_URLS.UPDATE_BULK_SUPPLIERS]: "Settings_Page__Suppliers",
  [INVENTORY_SERVICE_URLS.GET_SUPPLIERS_BY_IDS]: [
    {
      roleKey: "Settings_Page__Suppliers",
      action: "read",
    },
    {
      roleKey: "Settings_Page__Items",
      action: "read",
    },
    {
      roleKey: "Orders_Page__Purchase_Orders",
      action: "read",
    },
  ],
  [INVENTORY_SERVICE_URLS.SEARCH_ALL_SUPPLIERS]: [
    {
      roleKey: "Settings_Page__Suppliers",
      action: "read",
    },
    {
      roleKey: "Settings_Page__Items",
      action: "read",
    },
    {
      roleKey: "Orders_Page__Purchase_Orders",
      action: "read",
    },
  ],

  // ABC Class management
  [INVENTORY_SERVICE_URLS.ADD_ABC_CLASS]: "Settings_Page__Inventory",
  [INVENTORY_SERVICE_URLS.GET_ALL_ABC_CLASSES]: "Settings_Page__Inventory",
  [INVENTORY_SERVICE_URLS.GET_ABC_CLASS_BY_ID]: "Settings_Page__Inventory",
  [INVENTORY_SERVICE_URLS.UPDATE_ABC_CLASS]: "Settings_Page__Inventory",
  [INVENTORY_SERVICE_URLS.UPDATE_ABC_CLASS_STATUS]: "Settings_Page__Inventory",
  [INVENTORY_SERVICE_URLS.DELETE_ABC_CLASS]: "Settings_Page__Inventory",
  [INVENTORY_SERVICE_URLS.UPDATE_BULK_ABC_CLASSES]: "Settings_Page__Inventory",

  // Legacy endpoints
  [INVENTORY_SERVICE_URLS.GET_MANY_PRODUCTS_BY_ID]: [
    {
      roleKey: "Settings_Page__Items",
      action: "read",
    },
    {
      roleKey: "Orders_Page__Purchase_Orders",
      action: "read",
    },
    {
      roleKey: "Settings_Page__Account_Setup__Sales_Order",
      action: "read",
    },
  ],
  [INVENTORY_SERVICE_URLS.GET_MANY_PRODUCTS_BY_VID]: [
    {
      roleKey: "Settings_Page__Items",
      action: "read",
    },
    {
      roleKey: "Orders_Page__Purchase_Orders",
      action: "read",
    },
    {
      roleKey: "Settings_Page__Account_Setup__Sales_Order",
      action: "read",
    },
  ],
  [INVENTORY_SERVICE_URLS.GET_ONE_BY_VID]: [
    {
      roleKey: "Settings_Page__Items",
      action: "read",
    },
    {
      roleKey: "Inventory_Page__Items_List",
      action: "read",
    },
  ],
  [INVENTORY_SERVICE_URLS.UPDATE_VARIANT_STATUS]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.DUPLICATE_VARIANT]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.DELETE_VARIANT]: "Settings_Page__Items",
  [INVENTORY_SERVICE_URLS.INVENTORY_ADJUSTMENT]: "Inventory_Page__Items_List",
  [INVENTORY_SERVICE_URLS.INVENTORY_TRANSFER]: "Inventory_Page__Items_List",
  [INVENTORY_SERVICE_URLS.GET_CHART_DATA]: [
    {
      roleKey: "Warehouse_Page__Warehouse_Overview",
      action: "read",
    },
    {
      roleKey: "Inventory_Page__Inventory_Overview",
      action: "read",
    },
    {
      roleKey: "Orders_Page__Order_Overview",
      action: "read",
    },
    {
      roleKey: "Dashboard_Page",
      action: "read",
    },
  ],
  [INVENTORY_SERVICE_URLS.UPDATE_ITEM_QUANTITY_PUTAWAY]: "Put_Away",
  [INVENTORY_SERVICE_URLS.UPDATE_ITEM_QUANTITY_PICKING]: "Picking",

  // Integration management
  [INVENTORY_SERVICE_URLS.GET_ACTIVE_INTEGRATIONS]:
    "Settings_Page__Integrations",
  [INVENTORY_SERVICE_URLS.GET_INTEGRATION]: "Settings_Page__Integrations",
  [INVENTORY_SERVICE_URLS.GET_INTEGRATION_OPEN]: true,
  [INVENTORY_SERVICE_URLS.UPDATE_INTEGRATION]: "Settings_Page__Integrations",
  [INVENTORY_SERVICE_URLS.VALIDATE_SHOPIFY_STORE]:
    "Settings_Page__Integrations",
};

module.exports.checkPermission = (path, action, role) => {
  if (!role) return false;

  const permissionKey = URL_TO_ROLE_KEY_LOOKUP[path];

  if (!permissionKey) return false;

  if (permissionKey === true) return true;

  const permissions = role.permissions;

  if (Array.isArray(permissionKey)) {
    return permissionKey.some((role) => {
      const { roleKey, action } = role;
      const permissionObj = permissions[roleKey];

      return permissionObj && permissionObj[action];
    });
  }

  const permissionObj = permissions[permissionKey];

  const defaultPermission = permissionObj && permissionObj[action];

  return defaultPermission;
};

module.exports = {
  INVENTORY_SERVICE_URLS,
};
