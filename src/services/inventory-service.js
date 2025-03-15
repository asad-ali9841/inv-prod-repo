const { InventoryRepository } = require("../database");
const { SupplierModel } = require("../database/models");
const {
  createAcitivityLog,
  createNewPayload,
  detectChangesInUpdate,
  generateNextProductId,
  errorHandler,
  apiPayloadFormat,
  createBarcode,
} = require("../utils");
var qs = require("qs");
const mongoose = require("mongoose");
const {
  getWH,
  addQtyToLoc,
  getLocationsByIds,
} = require("../api-calls/inventory-api-calls");
const _ = require("lodash");
const {
  VARAINT_OBJECT_COLUMNS,
  PRODUCT_OBJECT_COLUMNS,
  ITEM_STATUS,
  ITEM_TYPE,
} = require("../utils/constants");

/*
        This file contains all the business logics
*/

class InventoryService {
  constructor() {
    this.respository = new InventoryRepository();
    // Bind the updateCatStatus function to use the errorHandler
    this.autoBindErrorHandlers();
  }
  autoBindErrorHandlers() {
    Object.getOwnPropertyNames(InventoryService.prototype)
      .filter(
        (method) =>
          method !== "constructor" && method !== "autoBindErrorHandlers"
      )
      .forEach((method) => {
        if (
          this[method] instanceof Function &&
          this[method].constructor.name === "AsyncFunction"
        ) {
          this[method] = errorHandler(this[method].bind(this));
        }
      });
  }

  async getConfigAttributes() {
    const configuredAttributes = await this.respository.getConfiguredAttributes(
      "673c29531f6cd3fc24ce9099"
    );
    let retObj = configuredAttributes.toObject();
    let newAct = configuredAttributes.activity.sort(
      (a, b) => b.date - a.date
    )[0];
    retObj.activity = newAct;
    delete retObj.__v;
    return apiPayloadFormat(1, "success", "List of Attributes", retObj);
  }

  async updateConfigAttributes(payload) {
    const { attributes, user } = payload;
    //let prevAttri =  await this.respository.getConfiguredAttributes(configKey)
    let activityLog = createAcitivityLog(
      user,
      "Product Configuration Updated",
      "",
      []
    );
    //prevAttri.attributes = attributes;
    //prevAttri.updatedAt = Date.now();
    const configAttributes = await this.respository.updateConfiguredAttributes(
      "673c29531f6cd3fc24ce9099",
      attributes,
      activityLog
    );
    if (!configAttributes)
      return apiPayloadFormat(0, "error", "Update Failed", configAttributes);
    return apiPayloadFormat(1, "success", "Conifguration updated sucessfully", {
      _id: "673c29531f6cd3fc24ce9099",
      activity: activityLog,
      createdAt: configAttributes.createdAt,
      updatedAt: configAttributes.updatedAt,
    });
  }
  // *# Lists for Products
  async getItemList(queryParams, authKey) {
    const filterQuery = qs.parse(queryParams);

    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const { filters, sortField, sortOrder, columns } = filterQuery;
    const variantSortField = sortField.split(".")[1];
    const correctedSortField = sortField.startsWith("variants.")
      ? VARAINT_OBJECT_COLUMNS.includes(variantSortField)
        ? `${variantSortField}.label`
        : variantSortField
      : PRODUCT_OBJECT_COLUMNS.includes(sortField)
      ? `${sortField}.label`
      : sortField;
    const sortOptions = {
      [correctedSortField]: Number(sortOrder),
    };

    const fetchedItemList = await this.respository.fetchInventoryItems(
      page,
      limit,
      columns,
      filters,
      sortOptions,
      authKey
    );
    console.log(fetchedItemList);
    if (fetchedItemList)
      return apiPayloadFormat(
        1,
        "success",
        "Item List fetched successfully",
        fetchedItemList,
        ""
      );

    return apiPayloadFormat(1, "error", "No Items found", [], "");
  }

  /*
            2. Get all products
    --------------------------------------------  
  */
  async getAllProducts(queryParams) {
    // let params = {
    //   page: 1,
    //   limit: 10,
    //   columns: [
    //     "productName",
    //     "productDescription",
    //     "productId",
    //     "productCategory",
    //     "activity",
    //   ],
    //   filters: {
    //     name: "",
    //     //'variants.variantId': ['3DL00000301']
    //     // productCategory: ['Apparel'],
    //     // status: ['active']
    //   },
    // };
    // const filterQueryCreate = qs.stringify(params, { arrayFormat: 'brackets'});
    // console.log(filterQueryCreate)

    const filterQuery = qs.parse(queryParams);
    console.log("filterQuery", filterQuery);

    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const columnsArray = filterQuery.columns;
    const columnsJson = columnsArray.reduce((acc, key) => {
      acc[key] = 1;
      return acc;
    }, {});
    const fetchedProducts = await this.respository.fetchProductsDB(
      page,
      limit,
      columnsJson,
      filterQuery.filters
    );
    if (fetchedProducts)
      return apiPayloadFormat(
        1,
        "success",
        "Products fetched successfully",
        fetchedProducts,
        ""
      );
    return apiPayloadFormat(1, "error", "No products found", [], "");
  }

  async searchAllProducts(queryParams) {
    // queryParams= {
    //   page: 1,
    //   limit: 10,
    //   status: ['active'],
    //   supplierCustomId: "SUP9587",
    //   searchText: "2",
    // }

    const filterQuery = qs.parse(queryParams);
    console.log("filterQuery 1", filterQuery);

    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const status = filterQuery.status;
    const supplierCustomId = filterQuery.supplierCustomId;
    const searchText = filterQuery.searchText;

    const fetchedProducts = await this.respository.searchProductsDB(
      page,
      limit,
      status,
      supplierCustomId,
      searchText
    );
    if (fetchedProducts)
      return apiPayloadFormat(
        1,
        "success",
        "Products fetched successfully",
        fetchedProducts,
        ""
      );
    return apiPayloadFormat(1, "error", "No products found", [], "");
  }

  async getManyById(idArray) {
    //return JSON.parse(idArray)
    const allFetched = await this.respository.getManyProductsUsingId(
      JSON.parse(idArray)
    );
    return allFetched
      ? apiPayloadFormat(1, "success", "Fetched Products", allFetched)
      : apiPayloadFormat(0, "error", "Error Fetching Products", {});
  }

  async getManyByVId(idArray) {
    console.log(idArray);
    const allFetched = await this.respository.getManyProductsUsingVId(
      JSON.parse(idArray)
    );
    return allFetched
      ? apiPayloadFormat(1, "success", "Fetched Products", allFetched)
      : apiPayloadFormat(0, "error", "Error Fetching Products", {});
  }

  async getOneByVId(variantId) {
    //return JSON.parse(idArray)
    const allFetched = await this.respository.getOneProductUsingVId(variantId);
    return allFetched
      ? apiPayloadFormat(1, "success", "Fetched Product", allFetched)
      : apiPayloadFormat(0, "error", "Error Fetching Products", {});
  }
  /*
            3. Get a specific product by Id
      -----------------------------------------  
    */
  async getProductById(queryParams, authKey) {
    const fetchedProduct = await this.respository.fetchProductByKey(
      queryParams.productKey
    );
    // populating max qty & qty reserved at locations
    // Extracting location IDs from storageLocations
    const locationIds = [];

    fetchedProduct.variants.forEach((variant) => {
      Object.values(variant.storageLocations).forEach((locationsArray) => {
        locationsArray.forEach((location) => {
          locationIds.push(location.locationId);
        });
      });
    });
    // fetching locations using Id
    let locationsData = await getLocationsByIds(authKey, locationIds);
    if (locationsData.status === 0)
      return apiPayloadFormat(
        0,
        "error",
        "Unable to fetch product. Try again",
        {}
      );
    let data = locationsData.data;
    // Populate maxQty and qtyReserved
    fetchedProduct.variants.forEach((variant) => {
      Object.values(variant.storageLocations).forEach((locationsArray) => {
        locationsArray.forEach((location) => {
          const matchingData = data.find(
            (item) => item._id === location.locationId
          );
          if (matchingData) {
            location.maxQty = matchingData.maxQty;
            location.qtyReserved = matchingData.qtyReserved;
          }
        });
      });
    });
    if (fetchedProduct)
      return apiPayloadFormat(
        1,
        "success",
        "Product fetched successfully",
        fetchedProduct
      );
    return apiPayloadFormat(0, "info", "No product found", {});
  }
  /*
            4. Update a product
      -----------------------------------------  
    */
  // TODO Remove these images from S3
  // TODO Create log of updated keys
  async updateProduct(productKey, payload, userInfo, authKey) {
    // add transaction and roll it back
    // Start a Mongoose session for transaction
    const session = await mongoose.startSession();
    let updated = await this.respository.updateProductDB(
      productKey,
      payload,
      userInfo,
      session
    );
    // TODO: Trigger the quantity reserved
    const fetchedProduct = await this.respository.fetchProductByKey(productKey);
    // Only reserving spaces --> if stautus is not draft
    if (fetchedProduct.status !== "draft") {
      console.log("CALLING TO RESERVE LOC");
      let assignedLoc = await assignQtyToLocations(
        payload,
        authKey,
        fetchedProduct
      );
      if (assignedLoc.status === 0) {
        // location adding error
        await session.abortTransaction();
        session.endSession();
        return apiPayloadFormat(
          0,
          "error",
          "Error adding locations",
          assignedLoc
        );
      }
    }
    return updated;
    // OLD IMPLEMENTATION
    // let imagesToRemove = [];
    // let fetchProduct = await this.respository.fetchProductByKey(productKey);
    // if (!fetchProduct)
    //   return apiPayloadFormat(0, "error", "No product found", {});
    // const activity = createAcitivityLog(
    //   userInfo,
    //   "Product Updated",
    //   ["active, updated"],
    //   []
    // );
    // // handling the scenario of deleting images from S3 bucket
    // if ("productImages" in payload) {
    //   let images = findRemovedOldImages(
    //     payload.productImages,
    //     fetchProduct.productImages
    //   );
    //   imagesToRemove = [...images];
    // }
    // if (payload.variants) {
    //   // DELETING VARAINTS
    //   let variantsToRemove = [];
    //   payload.variants.map((ele) => {
    //     if ("isDeleted" in ele) {
    //       variantsToRemove.push(ele.variantId);
    //     }
    //   });
    //   fetchProduct.variants = fetchProduct.variants.filter(
    //     (item) => !variantsToRemove.includes(item.variantId)
    //   );

    //   // updating old variants
    //   let oldChangedVariants = payload.variants.filter(
    //     (ele) => "variantId" in ele
    //   );
    //   // Handle Images
    //   oldChangedVariants.map((variant) => {
    //     if ("variantImages" in variant) {
    //       // fectching the same variant from old data
    //       let oldData = fetchProduct.variants.find(
    //         (ele) => ele.variantId === variant.variantId
    //       );
    //       let images = findRemovedOldImages(
    //         variant.variantImages,
    //         oldData.variantImages || []
    //       );
    //       imagesToRemove = [...imagesToRemove, ...images];
    //     }
    //   });
    //   //return {oldChangedVariants, oldUnchangeVariants: fetchProduct.toObject().variants}
    //   let updatedOldVariants = updateOldVariants(
    //     oldChangedVariants,
    //     fetchProduct.toObject().variants
    //   );
    //   updatedOldVariants.map((ele) => {
    //     if (payload.variants.find((ele1) => ele1.variantId === ele.variantId))
    //       ele.activity.push(
    //         createAcitivityLog(
    //           userInfo,
    //           "Product Variant Updated",
    //           ["active, updated"],
    //           []
    //         )
    //       );
    //   });
    //   // getting the suffix for new variant
    //   let suffix = getVariantSuffixNumber(
    //     updatedOldVariants,
    //     fetchProduct.productId
    //   );
    //   let newVariants = payload.variants.filter((ele) => !("variantId" in ele));
    //   newVariants.map((data, i) => {
    //     const activity = [
    //       createAcitivityLog(userInfo, "Product Variant Created", []),
    //     ];
    //     data.variantId = fetchProduct.productId + (suffix + 1).toString();
    //     JsBarcode(svgNode, data.variantId, {
    //       xmlDocument: document,
    //       height: 50,
    //       width: 3,
    //       fontSize: 10,
    //       // format: "EAN13" // Uncomment and set format if needed
    //     });
    //     const barcodeSvg = xmlSerializer.serializeToString(svgNode);
    //     data.barcode = barcodeSvg;
    //     // Adding status --> manually
    //     data.status = "active";
    //     data.activity = activity;
    //     suffix++;
    //   });
    //   let newUpdatedVariants = [...updatedOldVariants, ...newVariants];
    //   payload.variants = newUpdatedVariants;
    // }
    // //console.log(payload)
    // //return payload
    // const updatedProduct = await this.respository.updateProductDb(
    //   productKey,
    //   payload,
    //   activity
    // );
    // //return updatedProduct
    // if (!updatedProduct)
    //   return apiPayloadFormat(0, "error", "Error Updating Product data", {});
    // return apiPayloadFormat(1, "success", "Updated Product data", {
    //   _id: updatedProduct._id,
    //   activity: updatedProduct.activity.sort((a, b) => b.date - a.date)[0],
    //   createdAt: updatedProduct.createdAt,
    //   updatedAt: updatedProduct.updatedAt,
    //   variants: updatedProduct.variants.map((ele) => {
    //     return {
    //       _id: ele._id,
    //       variantId: ele.variantId,
    //       variantDescription: ele.variantDescription,
    //       barcode: ele.barcode,
    //       //activity : ele.activity.sort((a, b) => b.date - a.date)[0],
    //     };
    //   }),
    // });
  }
  /*
              5. Change status of product
      ------------------------------------------
    */
  async changeStatusProd(queryParams, userInfo) {
    const productKey = queryParams.productKey;
    const status = queryParams.status;
    const updatedProduct = await this.respository.updateProductStatus(
      productKey,
      status,
      userInfo
    );
    return updatedProduct;
  }

  async deleteProd(queryParams, userInfo) {
    const productKey = queryParams.productKey;
    const status = "deleted";

    const updatedProduct = await this.respository.updateProductStatus(
      productKey,
      status,
      userInfo
    );
    return updatedProduct;
  }

  async duplicateProductService(productKey, userInfo) {
    let duplicate = this.respository.duplicateProduct(productKey, userInfo);
    return duplicate;
  }

  async updateBulkProducts(userInputs, userInfo) {
    try {
      const { productsArray, status } = userInputs;

      const result = await this.respository.bulkUpdateProductsStatus(
        productsArray,
        status,
        userInfo
      );

      // Combine final results
      const partialErrors = result
        .filter((res) => !res.success)
        .map((ele) => `${ele.data._id} cannot be updated: ${ele.error}`);

      if (partialErrors.length === 0) {
        return apiPayloadFormat(1, "success", "Updated all", result);
      } else {
        return apiPayloadFormat(1, "error", partialErrors, result);
      }
    } catch (error) {
      console.log("Error bulk updating products:", error);

      return apiPayloadFormat(
        0,
        "error",
        `Could not bulk update: ${error.message}`,
        {}
      );
    }
  }

  /*
              Product Variant Services
      ------------------------------------------
  */

  async updateVariantStatus(payload, userInfo) {
    const { variantKey, variantId, status } = payload;

    try {
      const updatedVariant = await this.respository.updateVariantStatus(
        variantKey,
        variantId,
        status,
        userInfo
      );

      return apiPayloadFormat(1, "success", "Variant updated", updatedVariant);
    } catch (error) {
      console.error("Error updating variant status:", error);

      return apiPayloadFormat(
        0,
        "error",
        `Error updating variant status: ${error.message}`,
        {}
      );
    }
  }

  async duplicateVariant(variantId, userInfo) {
    try {
      const duplicatedVariant = await this.respository.duplicateVariant(
        variantId,
        userInfo
      );

      return apiPayloadFormat(1, "success", "Variant duplicated", {
        ...duplicatedVariant,
      });
    } catch (error) {
      console.error("Error duplicating variant:", error);

      return apiPayloadFormat(
        0,
        "error",
        `Error duplicating variant: ${error.message}`,
        {}
      );
    }
  }

  async deleteVariant(variantId, userInfo) {
    try {
      const deleteResponse = await this.respository.deleteVariant(
        variantId,
        userInfo
      );

      return apiPayloadFormat(1, "success", "Variant deleted", deleteResponse);
    } catch (error) {
      console.error("Error deleting variant:", error);

      return apiPayloadFormat(
        0,
        "error",
        `Error deleting variant: ${error.message}`,
        {}
      );
    }
  }

  /*
              6. Add new list type
      ------------------------------------------
    */
  async addNewListItem(payload) {
    const activity = [createAcitivityLog(payload.user, "New list added", [])];
    payload.activity = activity;
    payload.status = "show";
    if (payload.hasLabelValue) {
      payload.labelValue = payload.data;
      delete payload.data;
    }
    const newItemData = await this.respository.addItemList(payload);
    if (!newItemData)
      return apiPayloadFormat(
        0,
        "error",
        "Server Error while adding Item Lists data",
        {}
      );
    return apiPayloadFormat(1, "success", "Added to database", {
      _id: newItemData._id,
      key: newItemData.key,
      data: newItemData.data,
      status: newItemData.status,
    });
  }

  async getAllListsKeys() {
    const itemsData = await this.respository.getAllItemsListKeys();
    if (!itemsData)
      return apiPayloadFormat(
        0,
        "error",
        "Server Error while fetching Item Lists data",
        {}
      );
    return apiPayloadFormat(1, "success", "Fetched data", itemsData);
  }

  async getAllLists(payload) {
    const itemsData = await this.respository.getAllItemsList(payload);
    if (!itemsData)
      return apiPayloadFormat(
        0,
        "error",
        "Server Error while fetching Item Lists data",
        {}
      );
    return apiPayloadFormat(1, "success", "Fetched data", itemsData);
  }

  async addItemToList(payload) {
    let { itemKey, itemValue, user } = payload;
    const item = await this.respository.getSpecificItemForUpdate(itemKey);
    if (!item)
      return apiPayloadFormat(0, "error", "No list found with this key", {});
    // TODO update the activity with change as well
    const activity = createAcitivityLog(user, "New item added to list", []);

    if (item.hasLabelValue) {
      // Ensure newData contains both label and value
      if (typeof itemValue === "string") {
        return apiPayloadFormat(
          0,
          "error",
          ["Type Error", "For label Value data, strings are not allowed"],
          {}
        );
      }
      const { label, value } = itemValue;

      if (typeof label !== "string" || typeof value !== "string") {
        return apiPayloadFormat(
          0,
          "error",
          [
            "Type Error",
            "For labelValue, both label and value must be strings.",
          ],
          {}
        );
      }

      // Check if the value already exists in labelValue
      const exists = item.labelValue.some((item) => item.value === value);
      if (exists) {
        return apiPayloadFormat(
          0,
          "error",
          ["Duplication", `labelValue with value "${value}" already exists`],
          {}
        );
      }
      item.labelValue.push(itemValue);
    } else {
      const data = itemValue;
      if (typeof data !== "string") {
        return apiPayloadFormat(
          0,
          "error",
          ["Type Error", "For data array, data must be a string."],
          {}
        );
      }
      let exists = item.data.find((ele) => ele === itemValue.trim());
      item.data.push(itemValue.trim());
      if (exists)
        return apiPayloadFormat(
          0,
          "error",
          ["Duplication Error", "Duplicate Item Value"],
          {}
        );
    }
    item.activity.push(activity);
    item.updatedAt = Date.now();
    const updatedList = await this.respository.updateList(item);
    if (!updatedList)
      return apiPayloadFormat(
        0,
        "error",
        "Server Error while fetching Item Lists data",
        {}
      );
    let outObj = updatedList.toObject();
    delete outObj.activity;
    delete outObj.createdAt;
    delete outObj.updatedAt;
    delete outObj.__v;
    if (outObj.hasLabelValue) {
      outObj.data = outObj.labelValue;
      delete outObj.labelValue;
    } else {
      delete outObj.labelValue;
    }
    return apiPayloadFormat(1, "success", "Fetched data", outObj);
  }

  async updateListWithNew(payload) {
    let { itemKey, data, user } = payload;
    const item = await this.respository.getSpecificItemForUpdate(itemKey);
    if (!item)
      return apiPayloadFormat(0, "error", "No list found with this key", {});
    // TODO update the activity with change as well
    const activity = createAcitivityLog(user, "List updated", []);
    item.activity.push(activity);
    item.updatedAt = Date.now();
    if (item.hasLabelValue) {
      item.labelValue = data;
    } else {
      item.data = data;
    }
    const updatedList = await this.respository.updateList(item);
    if (!updatedList)
      return apiPayloadFormat(0, "error", "Server Error while updating", {});
    let outObj = updatedList.toObject();
    delete outObj.activity;
    delete outObj.createdAt;
    delete outObj.updatedAt;
    delete outObj.__v;
    if (outObj.hasLabelValue) {
      outObj.data = outObj.labelValue;
      delete outObj.labelValue;
    } else {
      delete outObj.labelValue;
    }
    return apiPayloadFormat(1, "success", "Fetched data", outObj);
  }
  // *# SUPPLIERS
  async addSupplier(payload, userInfo) {
    // create a random supplier Id
    if (payload.autoGenerateSupplierId) {
      let autoId = await this.respository.generateUniqueId();
      payload.customId = autoId;
    }
    //return payload
    const activityLog = createAcitivityLog(
      userInfo,
      payload.status === "active" ? "Supplier Created" : "Supplier Drafted",
      payload.status,
      []
    );
    payload.activity = activityLog;
    //payload.status = "active";
    let addedSupplier = await this.respository.saveSupplierToDB(payload);
    return addedSupplier
      ? apiPayloadFormat(1, "success", "Supplier added", {
          _id: addedSupplier._id,
          customId: addedSupplier.customId,
          status: addedSupplier.status,
          contactInfo: addedSupplier.contactInfo.map((ele) => {
            return { _id: ele._id };
          }),
          activity: activityLog,
          createdAt: addedSupplier.createdAt,
          updatedAt: addedSupplier.updatedAt,
        })
      : apiPayloadFormat(0, "error", "Error adding Supplier", {});
  }

  async addMultipleSuppliers(payloadArray, userInfo) {
    try {
      // Initialize an array to hold the suppliers to be saved
      const suppliersToSave = [];

      for (const payload of payloadArray) {
        const activity = [
          createAcitivityLog(
            userInfo,
            payload.status === "active"
              ? "Supplier Created"
              : "Supplier Drafted",
            payload.status,
            []
          ),
        ];

        // Generate and assign a customId
        if (payload.autoGenerateSupplierId) {
          let autoId = await this.respository.generateUniqueId();
          payload.customId = autoId;
        }

        // Prepare the supplier document
        payload.activity = activity;
        payload.status = payload.status || "draft"; // Set default status if not provided

        // Create a new Supplier instance (but not saving yet)
        const supplierInstance = new SupplierModel(payload);
        suppliersToSave.push(supplierInstance);
      }

      // Save all suppliers
      await this.respository.saveManySuppliers(suppliersToSave);

      return apiPayloadFormat(1, "success", "Suppliers added successfully", {});
    } catch (error) {
      console.error("Error adding multiple suppliers:", error);
      return apiPayloadFormat(
        0,
        "error",
        ["There was an error while adding suppliers", error.message],
        error.message
      );
    }
  }

  async searchSuppliers(queryParams) {
    const allSuppliers = await this.respository.searchSuppliersText(
      queryParams
    );
    return allSuppliers
      ? apiPayloadFormat("1", "success", "All Suppliers", allSuppliers, "")
      : apiPayloadFormat(
          "0",
          "error",
          "Error fetching Suppliers",
          [],
          "Inertanl Server Error"
        );
  }

  async getAllSuppliers(queryParams) {
    // let params = {
    //   page: 1,
    //   limit: 10,
    //   filters: {
    //     name: "",
    //     //status: ['active']
    //   },
    //   columns: ["customId", "name", "website", "type", "activity"],
    // };
    //const filterQueryCreate = qs.stringify(params, { arrayFormat: "brackets" });

    const filterQuery = qs.parse(queryParams);
    console.log("filterQuery", filterQuery);

    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const columnsArray = filterQuery.columns;
    const columnsJson = columnsArray.reduce((acc, key) => {
      acc[key] = 1;
      return acc;
    }, {});
    const fetchedSuppliers = await this.respository.fetchSuppliersDB(
      page,
      limit,
      columnsJson,
      filterQuery.filters
    );
    if (fetchedSuppliers)
      return apiPayloadFormat(
        1,
        "success",
        "Suppliers fetched successfully",
        fetchedSuppliers
      );
    return apiPayloadFormat(1, "info", "No Suppliers found", []);
  }

  async getSpecificSupplier(queryParams) {
    let key =
      queryParams.customId !== undefined
        ? { customId: queryParams.customId }
        : { _id: queryParams.supplierKey };
    if (key.customId !== undefined && key.customId === "")
      return apiPayloadFormat(0, "error", "No Supplier found", {});
    if (key._id !== undefined && key._id === "")
      return apiPayloadFormat(0, "error", "No Supplier found", {});
    const fetchedProduct = await this.respository.fetchSupplierByCustomId(key);
    if (fetchedProduct)
      return apiPayloadFormat(
        1,
        "success",
        "Supplier fetched successfully",
        fetchedProduct
      );
    return apiPayloadFormat(0, "error", "No Supplier found", {});
  }

  async updateSupplier(supplierKey, updatePayload, userData) {
    // Check if the original category exists
    const supplierExistence = await this.respository.fetchSupplierById(
      supplierKey
    );
    if (!supplierExistence)
      return apiPayloadFormat(
        0,
        "error",
        "Supplier not found. No Supplier exists with this Id",
        {}
      );

    let changes = detectChangesInUpdate(
      supplierExistence.toObject(),
      updatePayload
    );
    const activity = createAcitivityLog(
      userData,
      "Supplier Updated",
      ["active", "update"],
      changes
    );
    if (
      "autoGenerateSupplierId" in updatePayload &&
      updatePayload.autoGenerateSupplierId
    ) {
      let autoId = await this.respository.generateUniqueId();
      updatePayload.customId = autoId;
    }
    //console.log(updatePayload)
    //return updatePayload
    const updatedSupplier = await this.respository.updateSupplierDb(
      supplierKey,
      updatePayload,
      activity
    );
    if (!updatedSupplier)
      return apiPayloadFormat(0, "error", "Error updating supplier", {});
    return apiPayloadFormat(1, "success", "Supplier Updated Successfully", {
      _id: updatedSupplier._id,
      customId: updatedSupplier.customId,
      status: updatedSupplier.status,
      contactInfo: updatedSupplier.contactInfo.map((ele) => {
        return { _id: ele._id };
      }),
      activity,
      createdAt: updatedSupplier.createdAt,
      updatedAt: updatedSupplier.updatedAt,
    });
  }

  async updateSupplierStatus(queryParams) {
    const status = queryParams.status;
    const user = queryParams.user;
    const supplierKey = queryParams.supplierKey;

    // Check if the original warehouse exists
    const supplierExistence = await this.respository.fetchSupplierById(
      supplierKey
    );
    //return supplierExistence
    if (!supplierExistence)
      return apiPayloadFormat(0, "error", "Supplier not found", {});
    // TODO Record activity
    const logActivity = createAcitivityLog(
      user,
      `Supplier Status Updated`,
      status,
      []
    );
    const result = await this.respository.updateSupplierDb(
      supplierKey,
      { status },
      logActivity
    );
    return result
      ? apiPayloadFormat(1, "success", "Status updated successfully", {
          _id: supplierKey,
          customId: result.customId,
          status,
          activity: logActivity,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        })
      : apiPayloadFormat(0, "error", "Error updating status", {});
  }

  async deleteSupplier(queryParams) {
    const status = queryParams.status;
    const user = queryParams.user;
    const supplierKey = queryParams.supplierKey;

    // Check if the original warehouse exists
    const supplierExistence = await this.respository.fetchSupplierById(
      supplierKey
    );
    //return supplierExistence
    if (!supplierExistence)
      return apiPayloadFormat(0, "error", "Supplier not found", {});
    // TODO Record activity
    const logActivity = createAcitivityLog(
      user,
      "Supplier Deleted",
      status,
      []
    );
    const result = await this.respository.updateSupplierDb(
      supplierKey,
      { status },
      logActivity
    );
    return result
      ? apiPayloadFormat(1, "success", "Supplier Deleted successfully", {
          _id: supplierKey,
          customId: result.customId,
          status,
          activity: logActivity,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        })
      : apiPayloadFormat(0, "error", "Error deleting", {});
  }

  async updateBulkSuppliers(userInputs, userInfo) {
    const { suppliersArray, status } = userInputs;
    const updatePromises = suppliersArray.map(async (key) => {
      let supplierData = await this.respository.fetchSupplierById(key);
      if (!supplierData) {
        return { _id: key, success: false, error: "Supplier does not exist" };
      }
      const activityLog = createAcitivityLog(
        userInfo,
        `Updated Status to ${status}`,
        status,
        []
      );
      const newPayload = { status, activity: activityLog };
      return {
        _id: key,
        customId: supplierData.customId,
        updatedAt: Date.now(),
        data: newPayload,
      };
    });
    const suppliersToUpdate = await Promise.all(updatePromises);
    let partialToast = [];
    //if(suppliersToUpdate.filter(u => u.data).length === 0) return apiPayloadFormat(0, 'error', "Failed to update all suppliers. Inavalid data", {})
    const results = await this.respository.bulkUpdateSuppliers(
      suppliersToUpdate.filter((u) => u.data)
    );
    let finalResult = results.concat(suppliersToUpdate.filter((u) => u.error));
    suppliersToUpdate
      .filter((u) => u.success === false)
      .map((ele) => {
        partialToast.push(`${ele._id} cannot be updated: ${ele.error}`);
      });
    if (suppliersToUpdate.filter((u) => u.success === false).length === 0)
      return apiPayloadFormat(1, "success", "Updated all", finalResult);
    else return apiPayloadFormat(1, "error", partialToast, finalResult);
  }

  async searchAllSuppliers(queryParams) {
    // queryParams = {
    //   page: 1,
    //   limit: 2,
    //   searchText: "a",
    //   status: ["active"]
    // };
    //const filterQueryCreate = qs.stringify(params, { arrayFormat: "brackets" });

    const filterQuery = qs.parse(queryParams);
    console.log("filterQuery", filterQuery);

    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const searchText = filterQuery.searchText;
    const status = filterQuery.status;

    const fetchedSuppliers = await this.respository.searchSuppliersDB(
      page,
      limit,
      searchText,
      status
    );
    if (fetchedSuppliers)
      return apiPayloadFormat(
        1,
        "success",
        "Suppliers fetched successfully",
        fetchedSuppliers
      );
    return apiPayloadFormat(1, "info", "No Suppliers found", []);
  }

  async getAllSupplierByIds(ids) {
    const suppliers = await this.respository.fetchManySupplierByIds(
      JSON.parse(ids)
    );
    return apiPayloadFormat(
      1,
      "success",
      "List of suppliers by Ids",
      suppliers
    );
  }
  // *# ABC Class
  async addABCClass(payload, userInfo, authKey) {
    if (payload.warehouse !== "" || payload.status === "active") {
      // fetch warehoouse to check exist.
      let checkWH = await getWH(authKey, payload.warehouse);
      if (!checkWH)
        return apiPayloadFormat(0, "error", "Warehouse Id incorrect", {});
      if (checkWH && checkWH.status === 0)
        return apiPayloadFormat(0, "error", "Warehouse Id incorrect", {});
      if (checkWH && checkWH.status === 1 && checkWH.type !== "success")
        return apiPayloadFormat(0, "error", "Warehouse Id incorrect", {});
      let tmpWData = {
        _id: payload.warehouse,
        name: checkWH.data.name,
      };
      payload.warehouse = tmpWData;
    } else {
      payload.warehouse = {
        _id: "",
        name: "",
      };
    }

    const activityLog = createAcitivityLog(
      userInfo,
      payload.status === "active"
        ? "ABC Classification Created"
        : "ABC Classification Drafted",
      payload.status,
      []
    );
    payload.activity = activityLog;
    let addedClass = await this.respository.saveABCClassToDB(payload);
    //return addedClass
    return addedClass
      ? apiPayloadFormat(1, "success", "ABC Classification added", {
          _id: addedClass._id,
          status: addedClass.status,
          //warehouse: addedClass.warehouse,
          activity: activityLog,
          createdAt: addedClass.createdAt,
          updatedAt: addedClass.updatedAt,
        })
      : apiPayloadFormat(0, "error", "Error adding ABC Classification", {});
  }

  async getAllABCClasses(queryParams) {
    // let params = {
    //   page: 1,
    //   limit: 10,
    //   filters: {
    //     name: "Test",
    //     status: ["draft"],
    //   },
    //   columns: ["name", "dimension1", "status"],
    // };
    // const filterQueryCreate = qs.stringify(params, { arrayFormat: "brackets" });

    const filterQuery = qs.parse(queryParams);

    console.log("filterQuery", filterQuery);

    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const columnsArray = filterQuery.columns;
    const columnsJson = columnsArray.reduce((acc, key) => {
      acc[key] = 1;
      return acc;
    }, {});
    const fetchedABCs = await this.respository.fetchABCClassDB(
      page,
      limit,
      columnsJson,
      filterQuery.filters
    );
    if (fetchedABCs)
      return apiPayloadFormat(
        1,
        "success",
        "ABC classes fetched successfully",
        fetchedABCs
      );
    return apiPayloadFormat(1, "info", "No ABC classes found", []);
  }

  async getSpecificABCClass(queryParams) {
    const fetchedABC = await this.respository.fetchABCById(queryParams.abcKey);
    if (fetchedABC)
      return apiPayloadFormat(
        1,
        "success",
        "ABC class fetched successfully",
        fetchedABC
      );
    return apiPayloadFormat(0, "error", "No ABC class found", {});
  }

  async updateABCClass(abcKey, updatePayload, userData, authKey) {
    // Check if the original category exists
    const abcExist = await this.respository.fetchABCById(abcKey);
    if (!abcExist)
      return apiPayloadFormat(
        0,
        "error",
        "ABC Class not found. No Class exists with this Id",
        {}
      );

    // check WH ID
    if ("warehouse" in updatePayload) {
      // fetch warehoouse to check exist.
      let checkWH = await getWH(authKey, updatePayload.warehouse);
      if (!checkWH)
        return apiPayloadFormat(0, "error", "Warehouse Id incorrect", {});
      if (checkWH && checkWH.status === 0)
        return apiPayloadFormat(0, "error", "Warehouse Id incorrect", {});
      if (checkWH && checkWH.status === 1 && checkWH.type !== "success")
        return apiPayloadFormat(0, "error", "Warehouse Id incorrect", {});
      let tmpWData = {
        _id: updatePayload.warehouse,
        name: checkWH.data.name,
      };
      updatePayload.warehouse = tmpWData;
    }

    let changes = detectChangesInUpdate(abcExist.toObject(), updatePayload);
    // overwriting the dirty fields
    Object.keys(updatePayload).forEach((key) => {
      abcExist[key] = updatePayload[key];
    });
    const activity = createAcitivityLog(
      userData,
      "ABC Class Updated",
      [updatePayload.status ?? abcExist.status, "update"],
      changes
    );
    abcExist.activity.push(activity);
    abcExist.updatedAt = Date.now();

    //return abcExist
    const updatedABCClass = await this.respository.updateABCDb(abcExist);
    if (!updatedABCClass)
      return apiPayloadFormat(0, "error", "Error updating ABC Class", {});
    return apiPayloadFormat(1, "success", "ABC Class Updated Successfully", {
      _id: updatedABCClass._id,
      status: updatedABCClass.status,
      activity,
      createdAt: updatedABCClass.createdAt,
      updatedAt: updatedABCClass.updatedAt,
    });
  }
  async updateABCClassStatus(queryParams) {
    const status = queryParams.status;
    const user = queryParams.user;
    const abcKey = queryParams.abcKey;

    // Check if the abc class exist
    const abcExist = await this.respository.fetchABCById(abcKey);
    //return supplierExistence
    if (!abcExist)
      return apiPayloadFormat(0, "error", "ABC class not found", {});
    // TODO Record activity
    const logActivity = createAcitivityLog(
      user,
      status === "deleted" ? "ABC Class Deleted" : `Status Updated`,
      status,
      []
    );
    const result = await this.respository.updateABCStatusDb(
      abcKey,
      { status },
      logActivity
    );
    return result
      ? apiPayloadFormat(
          1,
          "success",
          status === "deleted"
            ? "ABC Class deleted successfully"
            : "Status updated successfully",
          {
            _id: abcKey,
            status,
            activity: logActivity,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
          }
        )
      : apiPayloadFormat(0, "error", "Error updating status", {});
  }
  //
  async updateBulkABCClasss(userInputs, userInfo) {
    const { abcArray, status } = userInputs;
    const updatePromises = abcArray.map(async (key) => {
      let abcclassData = await this.respository.fetchABCById(key);
      if (!abcclassData) {
        return { _id: key, success: false, error: "ABC Class does not exist" };
      }
      const activityLog = createAcitivityLog(
        userInfo,
        `Updated Status to ${status}`,
        status,
        []
      );
      const newPayload = { status, activity: activityLog };
      return {
        _id: key,
        customId: abcclassData.customId,
        updatedAt: Date.now(),
        data: newPayload,
      };
    });
    const abcclasssToUpdate = await Promise.all(updatePromises);
    let partialToast = [];
    //if(abcclasssToUpdate.filter(u => u.data).length === 0) return apiPayloadFormat(0, 'error', "Failed to update all abcclasss. Inavalid data", {})
    const results = await this.respository.bulkUpdateabcClasss(
      abcclasssToUpdate.filter((u) => u.data)
    );
    let finalResult = results.concat(abcclasssToUpdate.filter((u) => u.error));
    abcclasssToUpdate
      .filter((u) => u.success === false)
      .map((ele) => {
        partialToast.push(`${ele._id} cannot be updated: ${ele.error}`);
      });
    results
      .filter((u) => u.success === false)
      .map((ele) => {
        partialToast.push(`${ele._id} cannot be updated: ${ele.error}`);
      });

    if (abcclasssToUpdate.filter((u) => u.success === false).length === 0)
      return apiPayloadFormat(1, "success", "Updated all", finalResult);
    else return apiPayloadFormat(1, "error", partialToast, finalResult);
  }

  // *# INVENTORY
  async addInventoryItem(payload, userInfo) {
    let key = `${payload.productId}-${payload.warehouseId}`;
    let activity = createAcitivityLog(userInfo, "Inventory created", []);
    const customData = {
      id: key,
      productId: `${payload.productId}`,
      warehouseId: `${payload.warehouseId}`,
      quantity: parseInt(payload.quantity),
      reorderPoint: parseInt(payload.reorderPoint),
      reorderQuantity: parseInt(payload.reorderQuantity),
      minimumOrderQuantity: parseInt(payload.minimumOrderQuantity),
      safetyStockLevel: parseInt(payload.safetyStockLevel),
      leadTime: payload.leadTime,
      ABCCategory: payload.ABCCategory,
      inventoryTurnOverRate: payload.inventoryTurnOverRate,
      status: "active",
      location: JSON.parse(payload.location),
      activity: [activity],
    };
    await this.respository.addInventoryItemToDB(key, customData);
    return apiPayloadFormat(
      1,
      "success",
      "Inventory added to the system",
      {},
      ""
    );
  }

  async getInventoryItems(queryParams) {
    const { warehouseId } = queryParams;
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 10;
    const offset = (page - 1) * limit;
    const inventoryData = await this.respository.fetchInventory(
      warehouseId,
      offset,
      limit
    );
    return inventoryData
      ? apiPayloadFormat("1", "success", "Inventory data", inventoryData, "")
      : apiPayloadFormat(
          "0",
          "error",
          "Error fetching Inventory",
          [],
          "Internal Server Error"
        );
  }

  async updateInventoryItem(queryParams, updatePayload, userData) {
    const key = queryParams.key;
    // Check if the inventory exists
    const inventoryExistence = await this.respository.checkExistInventory(key);
    if (!inventoryExistence.exists) {
      return apiPayloadFormat(
        0,
        "error",
        "Inventory not found",
        [],
        "Inventory does not exist"
      );
    }

    let customPayload = createNewPayload(
      inventoryExistence.result.content,
      updatePayload
    );
    let changes = detectChangesInUpdate(
      inventoryExistence.result.content,
      customPayload
    );
    const activityLog = createAcitivityLog(userData, "Update", changes);
    customPayload.activity.push(activityLog);
    await this.respository.putUpdatedInv_DataToDB(key, customPayload);
    return apiPayloadFormat(
      1,
      "success",
      "Inventory data updated successfully",
      {},
      ""
    );
  }

  async updateInventoryStatus(queryParams) {
    const status = queryParams.status;
    const user = queryParams.user;
    const key = queryParams.key;
    // Check if the original warehouse exists
    const inventoryExistence = await this.respository.checkExistInventory(key);
    if (!inventoryExistence.exists) {
      console.log("inventory does not exist.");
      return apiPayloadFormat(
        0,
        "error",
        "Inventory not found",
        [],
        "Inventory does not exist"
      );
    }
    const logActivity = createAcitivityLog(
      user,
      status === "deleted"
        ? "Inventory deleted"
        : `Status changed to ${status}`,
      []
    );
    await this.respository.updateInventoryStatusToDB(key, status, logActivity);
    return status === "deleted"
      ? apiPayloadFormat(1, "success", "Deleted successfully", {}, "")
      : apiPayloadFormat(1, "success", "Status updated successfully", {}, "");
  }
  // *# PRODUCTS
  async addProductV3(payload, userInfo, authKey) {
    // TODO if abc cat is auto generated -- define rule
    // assigning product Id
    console.log("payload", payload);
    const session = await mongoose.startSession();
    session.startTransaction();

    let counter = await this.respository.getPreviousId(session);
    let productId = generateNextProductId(counter);
    payload.productId = productId;

    // updating variants payload.

    payload.variants.map((data, i) => {
      data.variantId = productId + (i + 1).toString();
      data.productId = productId;
      data.barcode = createBarcode(data.variantId);
      const variantActivity = [
        createAcitivityLog(
          userInfo,
          data.status === "active" ? "Variant Published" : "Variant drafted",
          data.status,
          []
        ),
      ];
      data.activity = variantActivity;
      data.productHasVariants = payload.productHasVariants;
      // For mutiple variants, if no image popluate the parent image
      data.variantImages ||= payload.productHasVariants
        ? payload.images
        : data.variantImages;
      // Converting sring to mongo object
      // if(data.itemType === ITEM_TYPE.kits || data.itemType === ITEM_TYPE.assembly){
      //   data.billOfMaterial.map(bom=>{
      //     bom.variant_id = new mongoose.Types.ObjectId(bom.variant_id)
      //   })
      // }
    });
    // for 1 variant copy the description to variant description
    if (!payload.productHasVariants) {
      payload.variants[0].variantDescription = payload.name;
      payload.variants[0].variantImages = payload.images;
    }

    let variantData = payload.variants;
    delete payload.variants;

    // adding currency manually
    payload.currency = {
      label: "AUD",
      value: "AU",
    };
    payload.variantCount = variantData.length;
    payload.activity = [
      createAcitivityLog(
        userInfo,
        payload.status === ITEM_STATUS.active
          ? "Product Published"
          : "Product drafted",
        payload.status,
        []
      ),
    ];
    payload.itemType = payload.item ?? variantData[0].itemType;
    const { id, itemType, createdVariants } =
      await this.respository.saveProductToDBV3(payload, variantData, session);
    //Only reserving spaces --> if stautus is not draft
    if (
      payload.status !== ITEM_STATUS.draft &&
      payload.itemType !== ITEM_TYPE.nonInventoryItems &&
      payload.itemType !== ITEM_TYPE.phantomItems
    ) {
      console.log("CALLING IN CASE OF NON-DRAFT");
      let assignedLoc = await assignQtyToLocations(createdVariants, authKey);
      if (assignedLoc.status === 0) {
        const result = assignedLoc.data.failedUpdates
          .map((update) => {
            const locationKey = update.locationKey || "No location key";
            return update.reasons.map(
              (reason) => `Location Key: ${locationKey}, Reason: ${reason}`
            );
          })
          .flat();
        await session.abortTransaction();
        session.endSession();
        return apiPayloadFormat(0, "error", result, {});
      }
    }
    await session.commitTransaction();
    session.endSession();
    const savedProduct = await this.respository.getSingleProductV3(
      id,
      itemType
    );
    return apiPayloadFormat(
      1,
      "success",
      payload.status === "active"
        ? "Product published sucessfully"
        : "Product drafted sucessfully",
      {
        _id: savedProduct._id,
        productId: savedProduct.productId,
        activity: savedProduct.activity[0],
        createdAt: savedProduct.createdAt,
        updatedAt: savedProduct.updatedAt,
        variants: savedProduct.variantIds.map((ele) => {
          return {
            _id: ele._id,
            variantId: ele.variantId,
            variantDescription: ele.variantDescription,
            barcode: ele.barcode,
            activity: ele.activity,
            createdAt: ele.createdAt,
            updatedAt: ele.updatedAt,
          };
        }),
      }
    );
  }

  async getAllProductsV3(queryParams) {
    const filterQuery = qs.parse(queryParams);

    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const { filters, sortField, sortOrder, columns } = filterQuery;
    const variantSortField = sortField.split(".")[1];
    const correctedSortField = sortField.startsWith("variants.")
      ? VARAINT_OBJECT_COLUMNS.includes(variantSortField)
        ? `${variantSortField}.label`
        : variantSortField
      : PRODUCT_OBJECT_COLUMNS.includes(sortField)
      ? `${sortField}.label`
      : sortField;
    const sortOptions = {
      [correctedSortField]: Number(sortOrder),
    };

    const fetchedProducts = await this.respository.fetchProductsDBV3(
      page,
      limit,
      columns,
      filters,
      sortOptions
    );
    if (fetchedProducts)
      return apiPayloadFormat(
        1,
        "success",
        "Products fetched successfully",
        fetchedProducts,
        ""
      );
    return apiPayloadFormat(1, "error", "No products found", [], "");
  }
  async getAllProductsByTypeV3(queryParams) {
    queryParams = {
      itemColumns: [
        "variantId",
        "variantDescription",
        "weight",
        "length",
        "width",
        "weightUnit",
        "lengthUnit",
        "weightCapacity",
        "capacityLength",
        "capacityWidth",
        "capacityHeight",
      ],
      sharedColumns: [],
      page: 1,
      limit: 100,
      filters: {
        itemType: "PackagingSupplies",
        status: "active",
      },
    };
    const filterQuery = qs.parse(queryParams);

    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const { filters, itemColumns } = filterQuery;

    const fetchedProducts = await this.respository.fetchProductsDBByQueryV3(
      page,
      limit,
      itemColumns,
      filters
    );
    if (fetchedProducts)
      return apiPayloadFormat(
        1,
        "success",
        "Products fetched successfully",
        fetchedProducts,
        ""
      );
    return apiPayloadFormat(1, "error", "No products found", [], "");
  }

  async getProductByIdV3(queryParams, authKey) {
    const fetchedProduct = await this.respository.fetchProductByKeyV3(
      queryParams.productKey
    );
    if (!fetchedProduct)
      return apiPayloadFormat(0, "error", "Product not found", {});
    // populating max qty & qty reserved at locations
    // Extracting location IDs from storageLocations
    const locationIds = [];

    for (const variant of fetchedProduct.variants) {
      // Handle case for items that don't have storage locations associated with them
      if (!variant.storageLocations)
        return apiPayloadFormat(
          1,
          "success",
          "Product fetched successfully",
          fetchedProduct
        );

      for (const locationsArray of Object.values(variant.storageLocations)) {
        for (const location of locationsArray) {
          locationIds.push(location.locationId);
        }
      }
    }
    // fetching locations using Id
    let locationsData = await getLocationsByIds(authKey, locationIds);
    if (locationsData.status === 0)
      return apiPayloadFormat(
        0,
        "error",
        "Unable to fetch product. Try again",
        {}
      );
    let data = locationsData.data;
    // Populate maxQty and qtyReserved
    fetchedProduct.variants.forEach((variant) => {
      Object.values(variant.storageLocations).forEach((locationsArray) => {
        locationsArray.forEach((location) => {
          const matchingData = data.find(
            (item) => item._id === location.locationId
          );
          if (matchingData) {
            location.maxQty = matchingData.maxQty;
            location.qtyReserved = matchingData.qtyReserved;
          }
        });
      });
    });

    return apiPayloadFormat(
      1,
      "success",
      "Product fetched successfully",
      fetchedProduct
    );
  }

  async updateProductV3(productKey, payload, userInfo, authKey) {
    // add transaction and roll it back
    // Start a Mongoose session for transaction
    const session = await mongoose.startSession();
    let updated = await this.respository.updateItemSharedDB(
      productKey,
      payload,
      userInfo,
      session
    );
    // TODO: Trigger the quantity reserved
    // const fetchedProduct = await this.respository.getSingleProductV3(productKey);
    // // Only reserving spaces --> if stautus is not draft
    // if (fetchedProduct.status !== "draft") {
    //   console.log("CALLING TO RESERVE LOC");
    //   let assignedLoc = await assignQtyToLocations(
    //     payload,
    //     authKey,
    //     fetchedProduct
    //   );
    //   if (assignedLoc.status === 0) {
    //     // location adding error
    //     await session.abortTransaction();
    //     session.endSession();
    //     return apiPayloadFormat(
    //       0,
    //       "error",
    //       "Error adding locations",
    //       assignedLoc
    //     );
    //   }
    // }
    return updated;
  }

  async deleteProdV3(queryParams, userInfo) {
    const productKey = queryParams.productKey;
    const status = "deleted";

    const updatedProduct = await this.respository.updateItemSharedStatusV3(
      productKey,
      status,
      userInfo
    );
    return updatedProduct;
  }

  async changeStatusProdV3(queryParams, userInfo) {
    const productKey = queryParams.productKey;
    const status = queryParams.status;
    const updatedProduct = await this.respository.updateItemSharedStatusV3(
      productKey,
      status,
      userInfo
    );
    return updatedProduct;
  }

  async addBulkProductsV3(bulkPayloads, userInfo, authKey) {
    // Start one Mongoose session/transaction for all products.
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // An array to store results for each newly created product.
      const results = [];

      for (const payload of bulkPayloads) {
        // --- 1. Generate a new productId ---
        let counter = await this.respository.getPreviousId(session);
        let productId = generateNextProductId(counter);
        payload.productId = productId;
        // --- 2. Pre-process variants ---
        if (Array.isArray(payload.variants)) {
          payload.variants.forEach((variantData, i) => {
            // Construct the variantId as productId + index
            variantData.variantId = productId + (i + 1).toString();
            variantData.productId = productId;

            // Generate a barcode string (SVG, base64, etc.) as needed
            variantData.barcode = createBarcode(variantData.variantId);

            // Create variant activity
            const variantActivity = [
              createAcitivityLog(
                userInfo,
                variantData.status === ITEM_STATUS.active
                  ? "Variant Published"
                  : "Variant Drafted",
                variantData.status,
                []
              ),
            ];
            variantData.activity = variantActivity;

            // Copy the productHasVariants field
            variantData.productHasVariants = payload.productHasVariants;

            // If multiple variants, and no variant images, copy from parent
            if (payload.productHasVariants && !variantData.variantImages) {
              variantData.variantImages = payload.images;
            }
          });

          // If only one variant, copy the product name/images down
          if (!payload.productHasVariants && payload.variants.length === 1) {
            payload.variants[0].variantDescription = payload.name;
            payload.variants[0].variantImages = payload.images;
          }
        }

        // --- 3. Prepare the parent payload ---
        // a) Move variants out of the parent payload
        const variantData = payload.variants || [];
        delete payload.variants;

        // b) Add currency
        payload.currency = {
          label: "AUD",
          value: "AU",
        };

        // c) variantCount
        payload.variantCount = variantData.length;

        // d) Add top-level activity
        payload.activity = [
          createAcitivityLog(
            userInfo,
            payload.status === ITEM_STATUS.active
              ? "Product Published"
              : "Product Drafted",
            payload.status,
            []
          ),
        ];

        // --- 4. Save the product + variants to the DB ---
        const { createdVariants } = await this.respository.saveProductToDBV3(
          payload,
          variantData,
          session
        );

        // --- 5. If the product is not draft, assign location qty ---
        if (
          payload.status !== ITEM_STATUS.draft &&
          payload.itemType !== ITEM_TYPE.nonInventoryItems &&
          payload.itemType !== ITEM_TYPE.phantomItems
        ) {
          const assignedLoc = await assignQtyToLocations(
            createdVariants,
            authKey
          );
          if (assignedLoc.status === 0) {
            // If location assignment fails, roll back the entire transaction
            const reasons = assignedLoc.data.failedUpdates
              .map((update) => {
                const locationKey = update.locationKey || "No location key";
                return update.reasons.map(
                  (reason) => `Location Key: ${locationKey}, Reason: ${reason}`
                );
              })
              .flat();
            throw new Error(reasons.join(" | "));
          }
        }
        // --- 6. Fetch the newly saved product for final response ---
        // const savedProduct = await this.respository.getSingleProductV3(
        //   id,
        //   itemType
        // );
        // console.log(savedProduct)
        // // Build a lightweight response object for just this product
        // const productResult = {
        //   _id: savedProduct._id,
        //   productId: savedProduct.productId,
        //   activity: savedProduct.activity[0],
        //   createdAt: savedProduct.createdAt,
        //   updatedAt: savedProduct.updatedAt,
        //   variants: (savedProduct.variantIds || []).map((ele) => ({
        //     _id: ele._id,
        //     variantId: ele.variantId,
        //     variantDescription: ele.variantDescription,
        //     barcode: ele.barcode,
        //     activity: ele.activity,
        //     createdAt: ele.createdAt,
        //     updatedAt: ele.updatedAt,
        //   })),
        // };

        // results.push(productResult);
        //session.endSession();
      }

      // --- 7. If all products processed successfully, commit the transaction ---
      await session.commitTransaction();
      session.endSession();

      // --- 8. Return a bulk success response ---
      return apiPayloadFormat(
        1,
        "success",
        "Bulk products added successfully",
        {
          products: results,
        }
      );
    } catch (error) {
      // Roll back if anything failed
      if (session.inTransaction()) {
        await session.abortTransaction().catch((abortErr) => {
          console.error("Error aborting transaction:", abortErr);
        });
      }
      session.endSession();
      console.error("Error adding bulk products:", error);

      return apiPayloadFormat(
        0,
        "error",
        error.message || "Error adding bulk products",
        {}
      );
    }
  }

  async duplicateProductServiceV3(productKey, userInfo) {
    let duplicate = this.respository.duplicateProductV3(productKey, userInfo);
    return duplicate;
  }

  async searchAllProductsV3(queryParams) {
    const filterQuery = qs.parse(queryParams);
    console.log("filterQuery", filterQuery);
    const page = parseInt(filterQuery.page) || 1;
    const limit = parseInt(filterQuery.limit) || 10;
    const status = filterQuery.status;
    const supplierCustomId = filterQuery.supplierCustomId;
    const searchText = filterQuery.searchText;

    const fetchedProducts = await this.respository.searchProductsDBV3(
      page,
      limit,
      status,
      supplierCustomId,
      searchText
    );
    if (fetchedProducts)
      return apiPayloadFormat(
        1,
        "success",
        "Products fetched successfully",
        fetchedProducts,
        ""
      );
    return apiPayloadFormat(1, "error", "No products found", [], "");
  }

  async downloadAll(payload) {
    const { items } = payload;
    const products = await this.respository.fetchProductForDownload(items);

    return products;
  }
}

// create loactions to write to Db
async function assignQtyToLocations(createdVariants, authKey) {
  if (!createdVariants || !createdVariants.length) return { status: 1 };
  const insertedVariants = createdVariants.map((doc) => doc.toObject());
  //console.log("ARRAY",insertedVariants);

  let result = [];

  insertedVariants.map((variant) => {
    // eslint-disable-next-line no-unused-vars
    for (const [key, locations] of variant.storageLocations) {
      // Inner loop: Iterate over the array of location objects
      for (const location of locations) {
        result.push({
          locationKey: location.locationId || "", // default empty if locationId is not present
          qtyReserved: location.maxQtyAtLoc,
          qtyOccupied: location.qtyAtLocation || 0, // default 0 if qtyAtLocation is not present
          qtyOccupiedBy: {},
          qtyReservedBy: {
            productId: variant.variantId,
            amount: location.maxQtyAtLoc,
          },
        });
      }
    }
  });
  console.log("FUNCTION CALLED FOR LOCATIONS RESERVING", result);
  // No need to call location APIs
  if (result.length === 0) return { status: 1 };
  return await addQtyToLoc(authKey, result);
}

module.exports = InventoryService;
