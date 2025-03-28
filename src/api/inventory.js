const InventoryService = require("../services/inventory-service");
const userAuth = require("./middlewares/auth");
//const multer = require("multer");
const {
  BUCKET_NAME,
  BUCKET_REGION,
  LOCAL_ACCESS_KEY,
  LOCAL_SECRET_KEY,
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

const s3 = new S3Client({
  region: BUCKET_REGION,
  credentials: {
    accessKeyId: LOCAL_ACCESS_KEY,
    secretAccessKey: LOCAL_SECRET_KEY,
  },
});

module.exports = (app) => {
  const service = new InventoryService();

  // *# HELPER APIs
  //Get product attributes
  app.get("/product/getattributes", async (req, res, next) => {
    try {
      const result = await service.getConfigAttributes();
      return res.json(result);
    } catch (error) {
      next(error);
    }
  });

  //Update/add configuration attributes
  app.put("/product/updateattributes", userAuth, async (req, res, next) => {
    try {
      req.body.user = req.user;
      const result = await service.updateConfigAttributes(req.body);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  });

  //Image PRESIGN URL
  app.post("/product/getimageurl", userAuth, async (req, res) => {
    try {
      const params = {
        Bucket: BUCKET_NAME, // Use your bucket name
        Key: req.body.name ?? `${Date.now()}`, // Name of the object to be uploaded
        ContentType: "image/jpeg", // Set MIME type for the object
      };

      // Create the command for the PutObject operation
      const command = new PutObjectCommand(params);

      // Generate the presigned URL with an expiration time of 300 seconds
      const url = await getSignedUrl(s3, command, { expiresIn: 300 });

      // Respond with the generated URL
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
  });

  //Image PRESIGN URL
  app.post("/product/getimagedownloadurl", userAuth, async (req, res) => {
    try {
      const { key } = req.body; // Get the object key from the request

      if (!key) {
        return res.status(400).json({
          status: 0,
          type: "error",
          responseMessage: "Missing 'key' parameter",
          data: {},
        });
      }

      const params = {
        Bucket: BUCKET_NAME, // Use your bucket name
        Key: key, // Key of the object to be downloaded
      };

      // Create the command for the GetObject operation
      const command = new GetObjectCommand(params);

      // Generate the pre-signed URL with an expiration time of 300 seconds (5 mins)
      const url = await getSignedUrl(s3, command, { expiresIn: 300 });

      // Respond with the generated URL
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
  });

  // Delete Image
  app.delete("/product/deleteimage", userAuth, async (req, res) => {
    const url = new URL(req.query.imageURL);
    const key = decodeURIComponent(url.pathname.substring(1)); // Extract the S3 key from the URL
    const params = {
      Bucket: BUCKET_NAME,
      Key: key, // File path + name
    };

    try {
      // Use the DeleteObjectCommand
      const command = new DeleteObjectCommand(params);
      let abc = await s3.send(command); // Await the send method
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
  });

  // *# PRODUCTS
  // Add
  app.post("/product/add/v3", userAuth, async (req, res, next) => {
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
  });

  // Get all
  app.get("/product/getall/v3", userAuth, async (req, res) => {
    const getAllProducts = await service.getAllProductsV3(req.query);
    return res.json(getAllProducts);
  });
  // Get specific by Id
  app.get("/product/getbyid/v3", userAuth, async (req, res, next) => {
    try {
      const getspecificProduct = await service.getProductByIdV3(
        req.query,
        req.get("Authorization")
      );
      return res.json(getspecificProduct);
    } catch (error) {
      next(error);
    }
  });

  // Update
  app.put("/product/update/v3", userAuth, async (req, res) => {
    const updatedProduct = await service.updateProductV3(
      req.query.productKey,
      req.body,
      req.user,
      req.get("Authorization")
    );
    return res.json(updatedProduct);
  });

  // Update status
  app.put("/product/status/update/v3", userAuth, async (req, res) => {
    const updatedStatus = await service.changeStatusProdV3(req.query, req.user);
    return res.json(updatedStatus);
  });

  // Delete
  app.delete("/product/delete/v3", userAuth, async (req, res) => {
    const deleted = await service.deleteProdV3(req.query, req.user);
    return res.json(deleted);
  });

  // Add Bulk
  app.post("/product/addbulk/v3", userAuth, async (req, res, next) => {
    try {
      const result = await service.addBulkProductsV3(req.body, req.user);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Duplicate
  app.post("/product/duplicate/v3", userAuth, async (req, res) => {
    const duplicated = await service.duplicateProductServiceV3(
      req.query.productKey,
      req.user
    );
    return res.json(duplicated);
  });

  // Search Products
  app.get("/product/getlist/search/v3", userAuth, async (req, res) => {
    const allProducts = await service.searchAllProductsV3(req.query);
    return res.json(allProducts);
  });

  app.get("/download/all/v3", async (req, res, next) => {
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
            if (PRODUCT_AND_VARIANT_ARRAY_COLUMNS.includes(correctedField)) {
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
        // Set headers for file download
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", "attachment; filename=items.xlsx");

        // Write the file to the response
        await workbook.xlsx.write(res);
        res.status(200).end();
      } else {
        // Set headers for CSV download
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=items.csv");

        // Write the file to the response
        await workbook.csv.write(res);
        res.status(200).end();
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/product/getall/byquery/v3", userAuth, async (req, res) => {
    const getAllProducts = await service.getAllProductsByTypeV3(req.query);
    return res.json(getAllProducts);
  });

  // *# Lists for Products

  //Inventory Item List
  app.get("/itemlist", userAuth, async (req, res) => {
    const itemList = await service.getItemList(
      req.query,
      req.get("Authorization")
    );
    return res.json(itemList);
  });

  //New item type to list
  app.post("/addnewlist", userAuth, async (req, res) => {
    req.body.user = req.user;
    const addedType = await service.addNewListItem(req.body);
    return res.json(addedType);
  });

  //Get list keys
  app.get("/getalllistkeys", userAuth, async (req, res) => {
    // const params = {
    //   Bucket: BUCKET_NAME,
    //   Key: 'testImage',
    //   Expires: 3600, // URL expiration time in seconds
    //   ContentType: 'image/jpeg', // or the appropriate MIME type
    // };
    // s3.getSignedUrl('putObject', params, (err, url) => {
    //   if (err) return res.status(500).send(err);
    //   return res.json({ url });
    // });

    const allTypes = await service.getAllListsKeys(req.query);
    return res.json(allTypes);
  });

  //Get all lists
  app.get("/getalllists", userAuth, async (req, res) => {
    const allTypes = await service.getAllLists(req.query);
    return res.json(allTypes);
  });

  //Add Item to list
  app.put("/additemtolist", userAuth, async (req, res) => {
    req.body.user = req.user;
    const updatedList = await service.addItemToList(req.body);
    return res.json(updatedList);
  });

  //Change List status
  app.put("/changestatusoflist", userAuth, async (req, res) => {
    req.query.user = req.user;
    const updatedType = await service.updateWarehouseTypeStatus(req.query);
    return res.json(updatedType);
  });

  //Update list (add or remove)

  app.put("/updatelist", userAuth, async (req, res) => {
    req.body.user = req.user;
    const updatedList = await service.updateListWithNew(req.body);
    return res.json(updatedList);
  });

  // *# SUPPLIER

  app.post("/supplier/add", userAuth, async (req, res, next) => {
    try {
      const addedSupplier = await service.addSupplier(req.body, req.user);
      return res.json(addedSupplier);
    } catch (error) {
      next(error);
    }
  });

  app.post("/supplier/addbulk", userAuth, async (req, res, next) => {
    try {
      const result = await service.addMultipleSuppliers(req.body, req.user);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  });

  //Get all suppliers
  app.get("/supplier/getall", userAuth, async (req, res) => {
    const allSuppliers = await service.getAllSuppliers(req.query);
    return res.json(allSuppliers);
  });

  app.get("/supplier/getbyid", userAuth, async (req, res) => {
    const allSuppliers = await service.getSpecificSupplier(req.query);
    return res.json(allSuppliers);
  });

  app.get("/supplier/getbyid/open", async (req, res) => {
    const allSuppliers = await service.getSpecificSupplier(req.query);
    return res.json(allSuppliers);
  });

  app.get("/supplier/search", userAuth, async (req, res) => {
    const allSuppliers = await service.searchSuppliers(req.query);
    return res.json(allSuppliers);
  });

  app.put("/supplier/update", userAuth, async (req, res) => {
    const updatedSupplier = await service.updateSupplier(
      req.query.supplierKey,
      req.body,
      req.user
    );
    return res.json(updatedSupplier);
  });

  app.put("/supplier/update/status", userAuth, async (req, res) => {
    req.query.user = req.user;
    const updatedSupplier = await service.updateSupplierStatus(req.query);
    return res.json(updatedSupplier);
  });

  app.delete("/supplier/delete", userAuth, async (req, res) => {
    req.query.user = req.user;
    req.query.status = "deleted";
    const deletedSupplier = await service.deleteSupplier(req.query);
    return res.json(deletedSupplier);
  });

  app.put("/supplier/updatebulk", userAuth, async (req, res, next) => {
    try {
      const bulkUpdated = await service.updateBulkSuppliers(req.body, req.user);
      return res.json(bulkUpdated);
    } catch (error) {
      next(error);
    }
  });

  app.get("/supplier/getall/ids", userAuth, async (req, res) => {
    const allSuppliers = await service.getAllSupplierByIds(req.query.ids);
    return res.json(allSuppliers);
  });

  app.get("/supplier/getlist/search", userAuth, async (req, res) => {
    const allSuppliers = await service.searchAllSuppliers(req.query);
    return res.json(allSuppliers);
  });

  // *# ABC Class
  app.post("/abcclass/add", userAuth, async (req, res, next) => {
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
  });

  app.get("/abcclass/getall", userAuth, async (req, res) => {
    const allClasses = await service.getAllABCClasses(req.query);
    return res.json(allClasses);
  });

  app.get("/abcclass/getbyid", userAuth, async (req, res) => {
    const abcClass = await service.getSpecificABCClass(req.query);
    return res.json(abcClass);
  });

  app.put("/abcclass/update", userAuth, async (req, res) => {
    const updatedABCClass = await service.updateABCClass(
      req.query.abcKey,
      req.body,
      req.user,
      req.get("Authorization")
    );
    return res.json(updatedABCClass);
  });

  app.put("/abcclass/update/status", userAuth, async (req, res) => {
    req.query.user = req.user;
    const updatedABCClass = await service.updateABCClassStatus(req.query);
    return res.json(updatedABCClass);
  });

  app.delete("/abcclass/delete", userAuth, async (req, res) => {
    req.query.user = req.user;
    req.query.status = "deleted";
    const deletedABCClass = await service.updateABCClassStatus(req.query);
    return res.json(deletedABCClass);
  });

  app.put("/abcclass/updatebulk", userAuth, async (req, res, next) => {
    try {
      const bulkUpdated = await service.updateBulkABCClasss(req.body, req.user);
      return res.json(bulkUpdated);
    } catch (error) {
      next(error);
    }
  });

  // !___________________________________________________________________________________
  // ! OLD CODE WILL DELETE SOON

  // Fetch many products using Id
  app.get("/product/getmanybyid", userAuth, async (req, res, next) => {
    try {
      const allFetched = await service.getManyById(req.query.idArray);
      return res.json(allFetched);
    } catch (error) {
      next(error);
    }
  });

  // Fetch many products using variants Id
  app.get("/product/getmanybyvid", async (req, res, next) => {
    try {
      const allFetched = await service.getManyByVId(
        req.query.idArray,
        req.query.statusArray
      );
      return res.json(allFetched);
    } catch (error) {
      next(error);
    }
  });
  // fetch a product using variant Id
  app.get("/product/getonebyvid", async (req, res, next) => {
    try {
      const allFetched = await service.getOneByVId(req.query.variantId);
      return res.json(allFetched);
    } catch (error) {
      next(error);
    }
  });

  app.put("/variant/status/update", userAuth, async (req, res) => {
    const updatedStatus = await service.updateVariantStatus(req.body, req.user);
    return res.json(updatedStatus);
  });

  app.post("/variant/duplicate", userAuth, async (req, res) => {
    const duplicated = await service.duplicateVariant(
      req.query.variantId,
      req.user
    );
    return res.json(duplicated);
  });

  app.delete("/variant/delete", userAuth, async (req, res) => {
    const deleted = await service.deleteVariant(req.query.variantId, req.user);
    return res.json(deleted);
  });

  app.put("/variant/inventoryadjustment", userAuth, async (req, res) => {
    const result = await service.performInventoryAdjustment(req.body, req.user);
    return res.json(result);
  });

  app.put("/variant/inventorytransfer", userAuth, async (req, res) => {
    const result = await service.performInventoryTransfer(
      req.body,
      req.user,
      req.get("Authorization")
    );
    return res.json(result);
  });

  app.put("/variant/addinventorylogs", userAuth, async (req, res) => {
    const result = await service.addInventoryLogs(req.body);
    return res.json(result);
  });

  app.get("/getchartdata", async (req, res, next) => {
    try {
      const chartData = await service.getChartData(
        req.query,
        req.get("Authorization")
      );
      return res.json(chartData);
    } catch (error) {
      next(error);
    }
  });
};
