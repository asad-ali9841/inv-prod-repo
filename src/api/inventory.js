const InventoryService = require("../services/inventory-service");
const userAuth = require("./middlewares/auth");
const { rbacMiddleware } = require("./middlewares/rbacMiddleware");
const {
  BUCKET_NAME,
  BUCKET_REGION,
  LOCAL_ACCESS_KEY,
  LOCAL_SECRET_KEY,
  baseURL,
  shopifyClientId,
  shopifyClientSecret,
} = require("../config/index");
const ExcelJS = require("exceljs");
const {
  camelCaseToNormalText,
  formatValue,
  formatStorageLocations,
  formatRelatedItems,
  formatBillOfMaterial,
  formatDateFromTimestamp,
  mapArrayToObject,
  getTotalQuantityForAllWarehouses,
  getShopifyAppHTML,
} = require("../utils/index");
var qs = require("qs");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  productKeysToLabels,
  PRODUCT_AND_VARIANT_ARRAY_COLUMNS,
  PRODUCT_OBJECT_COLUMNS,
  VARAINT_OBJECT_COLUMNS,
} = require("../utils/constants");
const { getActiveWarehouses } = require("../api-calls/inventory-api-calls");
const {
  retrieveSession,
  storeSession,
} = require("../shopify-integration/shopify-session-service");
const { shopify } = require("../shopify-integration/shopify-api-config");
const {
  storeState,
  verifyState,
} = require("../shopify-integration/oauthStateService");
const { INVENTORY_SERVICE_URLS } = require("../utils/rbac-utils");

const s3 = new S3Client({
  region: BUCKET_REGION,
  credentials: {
    accessKeyId: LOCAL_ACCESS_KEY,
    secretAccessKey: LOCAL_SECRET_KEY,
  },
});

module.exports = (app) => {
  const service = new InventoryService();

  // Shopify routes
  app.get(INVENTORY_SERVICE_URLS.SHOPIFY_AUTH, async (req, res) => {
    console.log("Auth route hit:", req.query);
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).send("Missing shop parameter");
    }

    try {
      // Check if we already have an active session
      const existingSession = await retrieveSession(shop);

      if (existingSession) {
        // Already authenticated
        return res.json({
          success: true,
          message: "Authenticated successfully",
          shop: existingSession.shop,
          scopes: existingSession.scope,
        });
      }

      // Generate a state value for CSRF protection
      const state = shopify.auth.nonce();
      console.log("Generated state:", state);

      // Store state in database
      await storeState(shop, state);

      // Instead of using shopify.auth.begin, manually construct the authorization URL
      const sanitizedShop = shopify.utils.sanitizeShop(shop, true);
      const scopes = shopify.config.scopes.toString();
      const redirectUri = encodeURIComponent(
        `${baseURL}/inventory/shopify/auth/callback`
      );

      const authUrl = `https://${sanitizedShop}/admin/oauth/authorize?client_id=${shopifyClientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

      console.log("Redirecting to manually constructed auth URL:", authUrl);
      res.redirect(authUrl);
    } catch (error) {
      console.error("Auth error:", error);
      res.status(500).send(`Authentication error: ${error.message}`);
    }
  });

  app.get(INVENTORY_SERVICE_URLS.SHOPIFY_AUTH_CALLBACK, async (req, res) => {
    console.log("Auth callback route hit:", "query:", req.query);

    const { shop, code, state } = req.query;

    if (!shop || !code) {
      return res.status(400).send("Missing required parameters");
    }

    try {
      // Verify state parameter to prevent CSRF attacks
      const isValidState = await verifyState(shop, state);

      if (!isValidState) {
        console.error("Invalid state parameter");
        return res.status(403).send("Invalid state parameter");
      }

      console.log("State verified, exchanging code for access token");

      // Manually exchange the code for an access token
      const accessTokenResponse = await fetch(
        `https://${shop}/admin/oauth/access_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: shopifyClientId,
            client_secret: shopifyClientSecret,
            code,
          }),
        }
      );

      const tokenData = await accessTokenResponse.json();
      console.log("Token exchange response:", tokenData);

      if (tokenData.access_token) {
        // Create a session object
        const shopifySession = {
          shop,
          accessToken: tokenData.access_token,
          scope: tokenData.scope,
          isOnline: false,
          expires: null,
        };

        // Store the session
        await storeSession(shopifySession);
        console.log("Session stored successfully", shopifySession);

        // Redirect to app home
        return res.redirect(
          `${baseURL}/inventory/shopify/app?shop=${encodeURIComponent(shop)}`
        );
      } else {
        throw new Error(
          "Failed to get access token: " + JSON.stringify(tokenData)
        );
      }
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send(`Error completing OAuth: ${error.message}`);
    }
  });

  app.get(INVENTORY_SERVICE_URLS.SHOPIFY_APP, async (req, res) => {
    console.log("shopify App route hit and req.query:", req.query);
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).send("Missing shop parameter");
    }

    try {
      // Check if the shop has installed the app
      const session = await retrieveSession(shop);
      console.log("Session retrieved:", session);
      if (!session) {
        // Use full URL for redirect and pass along all query parameters
        const queryParams = new URLSearchParams(req.query).toString();
        return res.redirect(`${baseURL}/inventory/shopify/auth?${queryParams}`);
      }

      // Shop is authenticated, render your app's main page
      res.send(getShopifyAppHTML(shop));
    } catch (error) {
      console.error("App route error:", error);
      res.status(500).send(`Error accessing app: ${error.message}`);
    }
  });

  // Product attributes
  app.get(
    INVENTORY_SERVICE_URLS.GET_PRODUCT_ATTRIBUTES,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_PRODUCT_ATTRIBUTES, "read"),
    async (req, res, next) => {
      try {
        const result = await service.getConfigAttributes();
        return res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_PRODUCT_ATTRIBUTES,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_PRODUCT_ATTRIBUTES, "update"),
    async (req, res, next) => {
      try {
        req.body.user = req.user;
        const result = await service.updateConfigAttributes(req.body);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Image management
  app.post(
    INVENTORY_SERVICE_URLS.GET_IMAGE_URL,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_IMAGE_URL, "create"),
    async (req, res) => {
      try {
        const params = {
          Bucket: BUCKET_NAME,
          Key: req.body.name ?? `${Date.now()}`,
          ContentType: "image/jpeg",
        };

        const command = new PutObjectCommand(params);
        const url = await getSignedUrl(s3, command, { expiresIn: 300 });

        return res.json({
          status: 1,
          type: "success",
          responseMessage: "Presigned URL for Image",
          data: { url },
        });
      } catch (err) {
        console.error("Error creating URL", err);
        return res.status(500).json({
          status: 0,
          type: "error",
          responseMessage: "Error creating URL",
          data: {},
        });
      }
    }
  );

  // *# HELPER APIs
  //Get product attributes
  app.get(
    INVENTORY_SERVICE_URLS.GET_PRODUCT_ATTRIBUTES,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_PRODUCT_ATTRIBUTES, "read"),
    async (req, res, next) => {
      try {
        const result = await service.getConfigAttributes();
        return res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  //Update/add configuration attributes
  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_PRODUCT_ATTRIBUTES,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_PRODUCT_ATTRIBUTES, "update"),
    async (req, res, next) => {
      try {
        req.body.user = req.user;
        const result = await service.updateConfigAttributes(req.body);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  //Image PRESIGN URL
  app.post(
    INVENTORY_SERVICE_URLS.GET_IMAGE_DOWNLOAD_URL,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_IMAGE_DOWNLOAD_URL, "read"),
    async (req, res) => {
      try {
        const { key } = req.body;

        if (!key) {
          return res.status(400).json({
            status: 0,
            type: "error",
            responseMessage: "Missing 'key' parameter",
            data: {},
          });
        }

        const params = {
          Bucket: BUCKET_NAME,
          Key: key,
        };

        const command = new GetObjectCommand(params);
        const url = await getSignedUrl(s3, command, { expiresIn: 300 });

        return res.json({
          status: 1,
          type: "success",
          responseMessage: "Presigned URL for Image",
          data: { url },
        });
      } catch (err) {
        console.error("Error creating URL", err);
        return res.status(500).json({
          status: 0,
          type: "error",
          responseMessage: "Error creating URL",
          data: {},
        });
      }
    }
  );

  // Delete Image
  app.delete(
    INVENTORY_SERVICE_URLS.DELETE_IMAGE,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.DELETE_IMAGE, "delete"),
    async (req, res) => {
      const url = new URL(req.query.imageURL);
      const key = decodeURIComponent(url.pathname.substring(1));
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
      };

      try {
        const command = new DeleteObjectCommand(params);
        let abc = await s3.send(command);
        return res.json({
          status: 1,
          type: "success",
          responseMessage: "Image deleted",
          data: {},
        });
      } catch (err) {
        console.error("Error deleting image", err);
        return res.status(500).json({
          status: 0,
          type: "error",
          responseMessage: "Error deleting image",
          data: {},
        });
      }
    }
  );

  // *# PRODUCTS
  // Add
  app.post(
    INVENTORY_SERVICE_URLS.ADD_PRODUCT,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.ADD_PRODUCT, "create"),
    async (req, res, next) => {
      try {
        const result = await service.addProductV3(
          req.body,
          req.user,
          req.get("Authorization")
        );
        return res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get all
  app.get(
    INVENTORY_SERVICE_URLS.GET_ALL_PRODUCTS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_ALL_PRODUCTS, "read"),
    async (req, res) => {
      const getAllProducts = await service.getAllProductsV3(req.query);
      return res.json(getAllProducts);
    }
  );
  // Get specific by Id
  app.get(
    INVENTORY_SERVICE_URLS.GET_PRODUCT_BY_ID,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_PRODUCT_BY_ID, "read"),
    async (req, res, next) => {
      try {
        const getspecificProduct = await service.getProductByIdV3(
          req.query,
          req.get("Authorization")
        );
        return res.json(getspecificProduct);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update
  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_PRODUCT,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_PRODUCT, "update"),
    async (req, res) => {
      const updatedProduct = await service.updateProductV3(
        req.query.productKey,
        req.body,
        req.user,
        req.get("Authorization")
      );
      return res.json(updatedProduct);
    }
  );

  // Update status
  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_PRODUCT_STATUS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_PRODUCT_STATUS, "update"),
    async (req, res) => {
      const updatedStatus = await service.changeStatusProdV3(
        req.query,
        req.user
      );
      return res.json(updatedStatus);
    }
  );

  // Delete
  app.delete(
    INVENTORY_SERVICE_URLS.DELETE_PRODUCT,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.DELETE_PRODUCT, "delete"),
    async (req, res) => {
      const deleted = await service.deleteProdV3(req.query, req.user);
      return res.json(deleted);
    }
  );

  // Add Bulk
  app.post(
    INVENTORY_SERVICE_URLS.ADD_BULK_PRODUCTS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.ADD_BULK_PRODUCTS, "create"),
    async (req, res, next) => {
      try {
        const result = await service.addBulkProductsV3(req.body, req.user);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Duplicate
  app.post(
    INVENTORY_SERVICE_URLS.DUPLICATE_PRODUCT,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.DUPLICATE_PRODUCT, "create"),
    async (req, res) => {
      const duplicated = await service.duplicateProductServiceV3(
        req.query.productKey,
        req.user
      );
      return res.json(duplicated);
    }
  );

  // Search Products
  app.get(
    INVENTORY_SERVICE_URLS.SEARCH_PRODUCTS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.SEARCH_PRODUCTS, "read"),
    async (req, res) => {
      const allProducts = await service.searchAllProductsV3(req.query);
      return res.json(allProducts);
    }
  );

  app.get(INVENTORY_SERVICE_URLS.DOWNLOAD_ALL, async (req, res, next) => {
    try {
      const filterQuery = {
        format: req.query.format,
        fields: req.query.fields.split(","),
        items:
          req.query.items && req.query.items.length
            ? req.query.items.split(",")
            : [],
      };

      const activeWHRes = await getActiveWarehouses(req.query.authKey);
      if (activeWHRes.status != 1 || activeWHRes.type !== "success")
        throw new Error("Could not fetch active warehouses");

      const activeWarehouses = activeWHRes.data.warehouse;
      const warehouseKeyToObject = mapArrayToObject(activeWarehouses, "_id");
      const products = await service.downloadAll(filterQuery);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Data");
      const fields = filterQuery.fields;

      // Add header row based on the fields array.
      const headerRow = [];
      fields.forEach((field) => {
        if (field === "variants.storageLocations") {
          headerRow.push("Warehouse");
          headerRow.push("Location Name");
          headerRow.push("Storage Location");
          headerRow.push("Maximum Storage Quantity");
        } else if (field === "relatedItems") {
          headerRow.push(camelCaseToNormalText("relatedItems_variantId"));
          headerRow.push(camelCaseToNormalText("relatedItems_name"));
        } else if (field === "billOfMaterial") {
          headerRow.push(camelCaseToNormalText("billOfMaterial_variantId"));
          headerRow.push(camelCaseToNormalText("billOfMaterial_name"));
          headerRow.push(camelCaseToNormalText("billOfMaterial_quantity"));
        } else {
          const correctedField = field.startsWith("variants.")
            ? field.replace(/^variants\./, "")
            : field;
          const headerField = productKeysToLabels[correctedField];
          headerRow.push(headerField);
        }
      });
      worksheet.addRow(headerRow);

      const correctedProducts = [];
      products.forEach((product) => {
        const { variantIds, ...productAttributes } = product;
        variantIds.forEach((variantId) => {
          const { storageLocations, ...variant } = variantId;

          if (storageLocations && Object.keys(storageLocations).length > 0) {
            Object.entries(storageLocations).forEach(([whKey, locations]) => {
              const warehouse = warehouseKeyToObject[whKey]?.name ?? "";

              locations
                .sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0))
                .forEach((location) => {
                  correctedProducts.push({
                    ...productAttributes,
                    variant,
                    storageLocation: {
                      warehouse,
                      ...location,
                    },
                  });
                });
            });
          } else {
            correctedProducts.push({
              ...productAttributes,
              variant,
            });
          }
        });
      });

      correctedProducts.forEach((product) => {
        const row = [];
        fields.forEach((field) => {
          const correctedField = field.startsWith("variants.")
            ? field.replace(/^variants\./, "")
            : field;
          const productAttribute = product[correctedField];

          if (correctedField === "storageLocations") {
            const storageLocation = product.storageLocation;

            if (storageLocation) {
              row.push(storageLocation.warehouse);
              row.push(storageLocation.customName);
              row.push(storageLocation.locationName);
              row.push(storageLocation.maxQtyAtLoc);
            } else {
              for (let i = 0; i < 4; i++) row.push("");
            }
          } else if (field.startsWith("variants.")) {
            const variantAttribute = product.variant[correctedField];
            if (correctedField === "totalQuantity") {
              row.push(
                variantAttribute
                  ? `${getTotalQuantityForAllWarehouses(variantAttribute)} ${
                      product.variant.unitType.value
                    }`
                  : ""
              );
            } else if (
              PRODUCT_AND_VARIANT_ARRAY_COLUMNS.includes(correctedField)
            ) {
              row.push(variantAttribute ? variantAttribute.join(", ") : "");
            } else if (VARAINT_OBJECT_COLUMNS.includes(correctedField)) {
              row.push(variantAttribute ? variantAttribute.value : "");
            } else if ("cycleCountAutoGenerated" === correctedField) {
              row.push(
                typeof variantAttribute === "boolean"
                  ? variantAttribute
                    ? "TRUE"
                    : "FALSE"
                  : "FALSE"
              );
            } else if (correctedField === "cycleCountMethod") {
              row.push(variantAttribute ? "Cycle Count" : "Physical Count");
            } else {
              row.push(variantAttribute ?? "");
            }
          } else {
            if (PRODUCT_AND_VARIANT_ARRAY_COLUMNS.includes(correctedField)) {
              row.push(productAttribute ? productAttribute.join(", ") : "");
            } else if (PRODUCT_OBJECT_COLUMNS.includes(correctedField)) {
              row.push(productAttribute ? productAttribute.label : "");
            } else if (["createdAt", "updatedAt"].includes(correctedField)) {
              row.push(
                formatDateFromTimestamp(productAttribute, "YYYY-MM-DD", "-")
              );
            } else if (correctedField === "itemType1") {
              row.push(productAttribute.replace(/Common$/, ""));
            } else {
              row.push(productAttribute ?? "");
            }
          }
        });

        worksheet.addRow(row);
      });

      if (filterQuery.format === "excel") {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", "attachment; filename=items.xlsx");
        await workbook.xlsx.write(res);
        res.status(200).end();
      } else {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=items.csv");
        await workbook.csv.write(res);
        res.status(200).end();
      }
    } catch (error) {
      next(error);
    }
  });

  app.get(
    INVENTORY_SERVICE_URLS.GET_PRODUCTS_BY_QUERY,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_PRODUCTS_BY_QUERY, "read"),
    async (req, res) => {
      const getAllProducts = await service.getAllProductsByTypeV3(req.query);
      return res.json(getAllProducts);
    }
  );

  // *# Lists for Products

  //Inventory Item List
  app.get(
    INVENTORY_SERVICE_URLS.GET_ITEM_LIST,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_ITEM_LIST, "read"),
    async (req, res) => {
      const itemList = await service.getItemList(
        req.query,
        req.get("Authorization")
      );
      return res.json(itemList);
    }
  );

  //New item type to list
  app.post(
    INVENTORY_SERVICE_URLS.ADD_NEW_LIST,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.ADD_NEW_LIST, "create"),
    async (req, res) => {
      req.body.user = req.user;
      const addedType = await service.addNewListItem(req.body);
      return res.json(addedType);
    }
  );

  //Get list keys
  app.get(
    INVENTORY_SERVICE_URLS.GET_ALL_LIST_KEYS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_ALL_LIST_KEYS, "read"),
    async (req, res) => {
      const allTypes = await service.getAllListsKeys(req.query);
      return res.json(allTypes);
    }
  );

  //Get all lists
  app.get(
    INVENTORY_SERVICE_URLS.GET_ALL_LISTS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_ALL_LISTS, "read"),
    async (req, res) => {
      const allTypes = await service.getAllLists(req.query);
      return res.json(allTypes);
    }
  );

  //Add Item to list
  app.put(
    INVENTORY_SERVICE_URLS.ADD_ITEM_TO_LIST,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.ADD_ITEM_TO_LIST, "create"),
    async (req, res) => {
      req.body.user = req.user;
      const updatedList = await service.addItemToList(req.body);
      return res.json(updatedList);
    }
  );

  //Change List status
  app.put(
    INVENTORY_SERVICE_URLS.CHANGE_LIST_STATUS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.CHANGE_LIST_STATUS, "update"),
    async (req, res) => {
      req.query.user = req.user;
      const updatedType = await service.updateWarehouseTypeStatus(req.query);
      return res.json(updatedType);
    }
  );

  //Update list (add or remove)
  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_LIST,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_LIST, "update"),
    async (req, res) => {
      req.body.user = req.user;
      const updatedList = await service.updateListWithNew(req.body);
      return res.json(updatedList);
    }
  );

  // *# SUPPLIER
  app.post(
    INVENTORY_SERVICE_URLS.ADD_SUPPLIER,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.ADD_SUPPLIER, "create"),
    async (req, res, next) => {
      try {
        const addedSupplier = await service.addSupplier(req.body, req.user);
        return res.json(addedSupplier);
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    INVENTORY_SERVICE_URLS.ADD_BULK_SUPPLIERS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.ADD_BULK_SUPPLIERS, "create"),
    async (req, res, next) => {
      try {
        const result = await service.addMultipleSuppliers(req.body, req.user);
        return res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  //Get all suppliers
  app.get(
    INVENTORY_SERVICE_URLS.GET_ALL_SUPPLIERS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_ALL_SUPPLIERS, "read"),
    async (req, res) => {
      const allSuppliers = await service.getAllSuppliers(req.query);
      return res.json(allSuppliers);
    }
  );

  app.get(
    INVENTORY_SERVICE_URLS.GET_SUPPLIER_BY_ID,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_SUPPLIER_BY_ID, "read"),
    async (req, res) => {
      const allSuppliers = await service.getSpecificSupplier(req.query);
      return res.json(allSuppliers);
    }
  );

  app.get(INVENTORY_SERVICE_URLS.GET_SUPPLIER_BY_ID_OPEN, async (req, res) => {
    const allSuppliers = await service.getSpecificSupplier(req.query);
    return res.json(allSuppliers);
  });

  app.get(
    INVENTORY_SERVICE_URLS.SEARCH_SUPPLIERS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.SEARCH_SUPPLIERS, "read"),
    async (req, res) => {
      const allSuppliers = await service.searchSuppliers(req.query);
      return res.json(allSuppliers);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_SUPPLIER,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_SUPPLIER, "update"),
    async (req, res) => {
      const updatedSupplier = await service.updateSupplier(
        req.query.supplierKey,
        req.body,
        req.user
      );
      return res.json(updatedSupplier);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_SUPPLIER_STATUS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_SUPPLIER_STATUS, "update"),
    async (req, res) => {
      req.query.user = req.user;
      const updatedSupplier = await service.updateSupplierStatus(req.query);
      return res.json(updatedSupplier);
    }
  );

  app.delete(
    INVENTORY_SERVICE_URLS.DELETE_SUPPLIER,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.DELETE_SUPPLIER, "delete"),
    async (req, res) => {
      req.query.user = req.user;
      req.query.status = "deleted";
      const deletedSupplier = await service.deleteSupplier(req.query);
      return res.json(deletedSupplier);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_BULK_SUPPLIERS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_BULK_SUPPLIERS, "update"),
    async (req, res, next) => {
      try {
        const bulkUpdated = await service.updateBulkSuppliers(
          req.body,
          req.user
        );
        return res.json(bulkUpdated);
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    INVENTORY_SERVICE_URLS.GET_SUPPLIERS_BY_IDS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_SUPPLIERS_BY_IDS, "read"),
    async (req, res) => {
      const allSuppliers = await service.getAllSupplierByIds(req.query.ids);
      return res.json(allSuppliers);
    }
  );

  app.get(
    INVENTORY_SERVICE_URLS.SEARCH_ALL_SUPPLIERS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.SEARCH_ALL_SUPPLIERS, "read"),
    async (req, res) => {
      const allSuppliers = await service.searchAllSuppliers(req.query);
      return res.json(allSuppliers);
    }
  );

  // *# ABC Class
  app.post(
    INVENTORY_SERVICE_URLS.ADD_ABC_CLASS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.ADD_ABC_CLASS, "create"),
    async (req, res, next) => {
      try {
        const addedClass = await service.addABCClass(
          req.body,
          req.user,
          req.get("Authorization")
        );
        return res.json(addedClass);
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    INVENTORY_SERVICE_URLS.GET_ALL_ABC_CLASSES,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_ALL_ABC_CLASSES, "read"),
    async (req, res) => {
      const allClasses = await service.getAllABCClasses(req.query);
      return res.json(allClasses);
    }
  );

  app.get(
    INVENTORY_SERVICE_URLS.GET_ABC_CLASS_BY_ID,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_ABC_CLASS_BY_ID, "read"),
    async (req, res) => {
      const abcClass = await service.getSpecificABCClass(req.query);
      return res.json(abcClass);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_ABC_CLASS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_ABC_CLASS, "update"),
    async (req, res) => {
      const updatedABCClass = await service.updateABCClass(
        req.query.abcKey,
        req.body,
        req.user,
        req.get("Authorization")
      );
      return res.json(updatedABCClass);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_ABC_CLASS_STATUS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_ABC_CLASS_STATUS, "update"),
    async (req, res) => {
      req.query.user = req.user;
      const updatedABCClass = await service.updateABCClassStatus(req.query);
      return res.json(updatedABCClass);
    }
  );

  app.delete(
    INVENTORY_SERVICE_URLS.DELETE_ABC_CLASS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.DELETE_ABC_CLASS, "delete"),
    async (req, res) => {
      req.query.user = req.user;
      req.query.status = "deleted";
      const deletedABCClass = await service.updateABCClassStatus(req.query);
      return res.json(deletedABCClass);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_BULK_ABC_CLASSES,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_BULK_ABC_CLASSES, "update"),
    async (req, res, next) => {
      try {
        const bulkUpdated = await service.updateBulkABCClasss(
          req.body,
          req.user
        );
        return res.json(bulkUpdated);
      } catch (error) {
        next(error);
      }
    }
  );

  // !___________________________________________________________________________________
  // ! OLD CODE WILL DELETE SOON

  // Fetch many products using Id
  app.get(
    INVENTORY_SERVICE_URLS.GET_MANY_PRODUCTS_BY_ID,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_MANY_PRODUCTS_BY_ID, "read"),
    async (req, res, next) => {
      try {
        const allFetched = await service.getManyById(req.query.idArray);
        return res.json(allFetched);
      } catch (error) {
        next(error);
      }
    }
  );

  // Fetch many products using variants Id
  app.get(
    INVENTORY_SERVICE_URLS.GET_MANY_PRODUCTS_BY_VID,
    async (req, res, next) => {
      try {
        const allFetched = await service.getManyByVId(
          req.query.idArray,
          req.query.variant_ids,
          req.query.descriptions,
          req.query.skus,
          req.query.statusArray,
          req.query.columns
        );
        return res.json(allFetched);
      } catch (error) {
        next(error);
      }
    }
  );
  // fetch a product using variant Id
  app.get(INVENTORY_SERVICE_URLS.GET_ONE_BY_VID, async (req, res, next) => {
    try {
      const allFetched = await service.getOneByVId(req.query.variantId);
      return res.json(allFetched);
    } catch (error) {
      next(error);
    }
  });

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_VARIANT_STATUS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_VARIANT_STATUS, "update"),
    async (req, res) => {
      const updatedStatus = await service.updateVariantStatus(
        req.body,
        req.user
      );
      return res.json(updatedStatus);
    }
  );

  app.post(
    INVENTORY_SERVICE_URLS.DUPLICATE_VARIANT,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.DUPLICATE_VARIANT, "create"),
    async (req, res) => {
      const duplicated = await service.duplicateVariant(
        req.query.variantId,
        req.user
      );
      return res.json(duplicated);
    }
  );

  app.delete(
    INVENTORY_SERVICE_URLS.DELETE_VARIANT,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.DELETE_VARIANT, "delete"),
    async (req, res) => {
      const deleted = await service.deleteVariant(
        req.query.variantId,
        req.user
      );
      return res.json(deleted);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.INVENTORY_ADJUSTMENT,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.INVENTORY_ADJUSTMENT, "update"),
    async (req, res) => {
      const result = await service.performInventoryAdjustment(
        req.body,
        req.user,
        req.get("Authorization")
      );
      return res.json(result);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.INVENTORY_TRANSFER,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.INVENTORY_TRANSFER, "update"),
    async (req, res) => {
      const result = await service.performInventoryTransfer(
        req.body,
        req.user,
        req.get("Authorization")
      );
      return res.json(result);
    }
  );

  app.post(
    INVENTORY_SERVICE_URLS.GET_CHART_DATA,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_CHART_DATA, "read"),
    async (req, res, next) => {
      try {
        const chartData = await service.getChartData(
          req.body,
          req.get("Authorization")
        );
        return res.json(chartData);
      } catch (error) {
        next(error);
      }
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_ITEM_QUANTITY_PUTAWAY,
    userAuth,
    rbacMiddleware(
      INVENTORY_SERVICE_URLS.UPDATE_ITEM_QUANTITY_PUTAWAY,
      "update"
    ),
    async (req, res) => {
      const product = await service.updateItemQuantity({
        data: req.body,
        user: req.user,
      });
      return res.json(product);
    }
  );

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_ITEM_QUANTITY_PICKING,
    userAuth,
    rbacMiddleware(
      INVENTORY_SERVICE_URLS.UPDATE_ITEM_QUANTITY_PICKING,
      "update"
    ),
    async (req, res) => {
      const product = await service.updateItemQuantityPicking({
        data: req.body,
        user: req.user,
      });
      return res.json(product);
    }
  );

  // Integration settings endpoints
  app.get(
    INVENTORY_SERVICE_URLS.GET_ACTIVE_INTEGRATIONS,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_ACTIVE_INTEGRATIONS, "read"),
    async (req, res) => {
      const result = await service.getActiveIntegrations();
      return res.json(result);
    }
  );

  app.get(
    INVENTORY_SERVICE_URLS.GET_INTEGRATION,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.GET_INTEGRATION, "read"),
    async (req, res) => {
      const result = await service.getIntegrationByKey(
        req.query.integrationKey
      );
      return res.json(result);
    }
  );

  app.get(INVENTORY_SERVICE_URLS.GET_INTEGRATION_OPEN, async (req, res) => {
    const result = await service.getIntegrationByKey(req.query.integrationKey);
    return res.json(result);
  });

  app.put(
    INVENTORY_SERVICE_URLS.UPDATE_INTEGRATION,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.UPDATE_INTEGRATION, "update"),
    async (req, res) => {
      const result = await service.updateIntegration(
        req.query.integrationKey,
        req.body
      );
      return res.json(result);
    }
  );

  app.post(
    INVENTORY_SERVICE_URLS.VALIDATE_SHOPIFY_STORE,
    userAuth,
    rbacMiddleware(INVENTORY_SERVICE_URLS.VALIDATE_SHOPIFY_STORE, "create"),
    async (req, res) => {
      const result = await service.validateShopifyStore(req.query.storeDomain);
      return res.json(result);
    }
  );
};
