const {
  ConfigurationModel,
  CounterModel,
  SupplierModel,
  ProductListsModel,
  ABCClassificatonModel,
  ItemModel,
  ItemSharedAttributesModel,
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
  IntegrationSettingsModel,
} = require("../models/index"); // Adjust the path to where your User model is located
const mongoose = require("mongoose");
const {
  createActivityLog,
  deleteImagesFromS3,
  duplicateS3Images,
  findLargestNumberString,
  incrementVariantId,
  getTotalQuantityFromStorageLocations,
  roundToTwoDecimals,
  generateInventoryLogs,
  parseArrayFilter,
  parseDateRangeFilter,
  getShopifyProductPayload,
  getTotalQuantityForAllWarehouses,
  updateShopifyItemQuantity,
} = require("../../utils/");
const {
  PRODUCT_ARRAY_COLUMNS,
  VARAINT_ARRAY_COLUMNS,
  ITEM_TYPE,
  ITEM_STATUS,
  INVENTORY_TRANSACTION_TYPES,
  DataSource,
  PRODUCT_ARRAY_FILTER_COLUMNS,
  PRODUCT_DATE_RANGE_FILTER_COLUMNS,
  PRODUCT_TEXT_FILTER_COLUMNS,
  VARIANT_TEXT_FILTER_COLUMNS,
  VARIANT_ARRAY_FILTER_COLUMNS,
  VARIANT_DATE_RANGE_FILTER_COLUMNS,
  itemsAtLocationColumns,
  SUPPLIER_STATUSES,
  SUPPLIER_DATE_RANGE_FILTER_COLUMNS,
  SUPPLIER_TEXT_FILTER_COLUMNS,
  SUPPLIER_ARRAY_FILTER_COLUMNS,
  VARIANT_ATTRIBUTES,
  KIT_ASSEMBLY_TYPE,
  INTEGRATION_DOCUMENT_ID,
} = require("../../utils/constants");

const {
  getActiveWarehouses,
  createInventoryTransferTasks,
  getLocationsByIdsForSelection,
} = require("../../api-calls/inventory-api-calls");

const Item = require("../models/Item");
const InventoryLog = require("../models/InventoryLog");
const {
  getTotalInventoryValueChartData,
  getTotalInventoryValuePerCategoryChartData,
} = require("../../utils/chart-data-methods");
const {
  createShopifyProduct,
  getShopifyProductByTitle,
  updateShopifyProduct,
} = require("../../shopify-integration/shopify-product-service");

/*
    This file serves the purpose to deal with database operations such as fetching and storing data
*/

class InventoryRepository {
  constructor() {
    //Binding all methods of the class to try-catch warpper
    this.autoBindErrorHandlers();
  }
  // Method to mind all methods of the class to try-catch warpper
  autoBindErrorHandlers() {
    Object.getOwnPropertyNames(InventoryRepository.prototype)
      .filter(
        (method) =>
          method !== "constructor" && method !== "autoBindErrorHandlers"
      )
      .forEach((method) => {
        if (
          this[method] instanceof Function &&
          this[method].constructor.name === "AsyncFunction"
        ) {
          this[method] = tryCatchHandler(this[method].bind(this));
        }
      });
  }
  // Get previous ID from counter table
  async getPreviousId(session) {
    try {
      const counter = await CounterModel.findByIdAndUpdate(
        { _id: "productId" },
        { $inc: { sequenceValue: 1 } },
        { new: true, upsert: true, session } // Pass the session here
      );

      if (!counter) {
        throw new Error("Counter not found or could not be updated");
      }
      return counter.sequenceValue; // Return the updated sequence value
    } catch (error) {
      await session.abortTransaction(); // Abort the transaction in case of error
      session.endSession(); // End the session
      throw error; // Re-throw the error for the calling function to handle
    }
  }

  async setCounterId(length) {
    const counter = await CounterModel.findByIdAndUpdate(
      { _id: "productId" },
      { $inc: { sequenceValue: length } },
      { new: true, upsert: true }
    );
    return counter.sequenceValue;
  }

  async getConfiguredAttributes(key) {
    const configuration = await ConfigurationModel.findById(key);
    return configuration;
  }

  async updateConfiguredAttributes(key, attributes, activity) {
    let saved = ConfigurationModel.findByIdAndUpdate(
      key,
      {
        $set: attributes,
        $push: { activity },
      },
      { new: true }
    );
    return saved;
  }

  // Inventory Item List
  async fetchInventoryItems(
    page,
    limit,
    columns,
    queryFilters,
    sortOptions = { createdAt: 1 },
    authKey
  ) {
    // (
    //   await ItemSharedAttributesModel.find({ status: ITEM_STATUS.deleted })
    // ).forEach((product) => {
    //   product.variantIds.forEach(async (variant_id) => {
    //     await ItemModel.deleteOne({ _id: variant_id });
    //   });
    // });
    // await ItemSharedAttributesModel.deleteMany({ status: ITEM_STATUS.deleted });
    const skip = (page - 1) * limit;

    const {
      name: searchText,
      selectedLocationIdentifier,
      ...filters
    } = queryFilters;
    delete filters.selectedWHKey;
    const warehouseIds = queryFilters.warehouseIds;

    if (!warehouseIds || warehouseIds.length === 0)
      return {
        items: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
      };
    try {
      // Fetch all active warehouses
      const activeWHRes = await getActiveWarehouses(authKey);
      if (activeWHRes.status != 1 || activeWHRes.type !== "success")
        throw new Error("Could not fetch active warehouses");

      const activeWarehouses = activeWHRes.data.warehouse;

      if (!activeWarehouses || activeWarehouses.length === 0)
        return {
          items: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
        };

      // Separate product and variant columns
      const productColumns = columns.filter(
        (column) => !column.startsWith("variants.")
      );
      const variantColumns = columns
        .filter((column) => column.startsWith("variants."))
        .map((column) => column.replace("variants.", "")); // Remove the `variants.` prefix

      // Initialize the aggregation pipeline
      const pipeline = [];

      // Step 1: Lookup to join Product data
      pipeline.push({
        $lookup: {
          from: "itemshareds", // The name of the Product collection
          localField: "sharedAttributes", // Field in Variant collection
          foreignField: "_id", // Field in Product collection
          as: "product", // Output array field
        },
      });
      // Step 2: Unwind the joined Product array to object
      pipeline.push({ $unwind: "$product" });
      // Spread the warehouseIds to separate variants based on warehouse
      pipeline.push({
        $unwind: {
          path: "$warehouseIds",
          preserveNullAndEmptyArrays: false, // Exclude null or empty arrays
        },
      });

      // Step 3: Build the match criteria based on input filters
      const match = {};

      // Filter based on selectedLocationIdentifier
      if (selectedLocationIdentifier) {
        const selectedLocationResponse = await getLocationsByIdsForSelection(
          authKey,
          undefined,
          [selectedLocationIdentifier],
          itemsAtLocationColumns
        );

        if (
          selectedLocationResponse.status != 1 ||
          selectedLocationResponse.type !== "success"
        )
          throw new Error("Could not fetch items at location");

        const selectedLocationVariantIds =
          selectedLocationResponse.data.flatMap((loc) =>
            loc.qtyReservedBy.map((qtyReserved) => qtyReserved.productId)
          );

        match["variantId"] = { $in: selectedLocationVariantIds };
      }

      // Apply searchText filter on variantDescription with case-insensitive regex
      if (searchText) {
        const escapedSearchText = escapeRegExp(searchText);
        match["variantDescription"] = {
          $regex: escapedSearchText,
          $options: "i",
        };
      }

      // Add other filters to the query using $in operator
      for (const [key, value] of Object.entries(filters)) {
        if (key === "warehouseIds") match[key] = { $in: value };
        else {
          if (key.startsWith("variants.")) {
            const variantKey = key.split(".")[1];

            if (VARIANT_TEXT_FILTER_COLUMNS.includes(variantKey)) {
              if (value) {
                const escapedSearchText = escapeRegExp(value);
                match[variantKey] = {
                  $regex: escapedSearchText,
                  $options: "i",
                };
              }
            } else if (VARIANT_ARRAY_FILTER_COLUMNS.includes(variantKey)) {
              const parsedFilter = parseArrayFilter(value);
              if (parsedFilter) {
                match[variantKey] = {
                  [`$${parsedFilter.operator}`]: parsedFilter.value,
                };
              }
            } else if (VARIANT_DATE_RANGE_FILTER_COLUMNS.includes(variantKey)) {
              const parsedFilter = parseDateRangeFilter(value);
              if (parsedFilter) {
                const { startDate, endDate } = parsedFilter;
                match[variantKey] = {
                  $gte: startDate.getTime(),
                  $lte: endDate.getTime(),
                };
              }
            }
          } else {
            if (PRODUCT_ARRAY_FILTER_COLUMNS.includes(key)) {
              const parsedFilter = parseArrayFilter(value);
              if (parsedFilter) {
                match[`product.${key}`] = {
                  [`$${parsedFilter.operator}`]: parsedFilter.value,
                };
              }
            } else if (key === "countryOfOrigin") {
              const parsedFilter = parseArrayFilter(value);
              if (parsedFilter) {
                match[`product.${key}.value`] = {
                  [`$${parsedFilter.operator}`]: parsedFilter.value,
                };
              }
            } else if (PRODUCT_TEXT_FILTER_COLUMNS.includes(key)) {
              if (value) {
                const escapedSearchText = escapeRegExp(value);
                match[`product.${key}`] = {
                  $regex: escapedSearchText,
                  $options: "i",
                };
              }
            }
          }
        }
      }

      match["status"] = { $in: ["active"] }; // Only active variants can appear in inventory

      // Add the match stage if there are any criteria
      if (Object.keys(match).length > 0) {
        pipeline.push({ $match: match });
      }

      pipeline.push({
        $addFields: {
          ...addProductArrayFields(productColumns),
          ...addVariantArrayFields(variantColumns),
          itemId: {
            $concat: ["$variantId", "~", "$warehouseIds"],
          },
          warehouse: {
            $arrayElemAt: [
              {
                $map: {
                  input: {
                    $filter: {
                      input: activeWarehouses,
                      cond: { $eq: ["$$this._id", "$warehouseIds"] },
                    },
                  },
                  as: "warehouse",
                  in: "$$warehouse.name", // Extract only the `name` attribute
                },
              },
              0,
            ],
          },
          qtyAtMainLocation: {
            $let: {
              vars: {
                locations: {
                  $getField: {
                    field: "$warehouseIds",
                    input: "$storageLocations",
                  },
                },
              },
              in: {
                $let: {
                  vars: {
                    mainLocation: {
                      $first: {
                        $filter: {
                          input: "$$locations",
                          as: "loc",
                          cond: { $eq: ["$$loc.isMain", true] },
                        },
                      },
                    },
                  },
                  in: "$$mainLocation.itemQuantity",
                },
              },
            },
          },
          qtyAtOtherLocations: {
            $let: {
              vars: {
                locations: {
                  $getField: {
                    field: "$warehouseIds",
                    input: "$storageLocations",
                  },
                },
              },
              in: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$$locations",
                        as: "loc",
                        cond: { $ne: ["$$loc.isMain", true] },
                      },
                    },
                    as: "loc",
                    in: "$$loc.itemQuantity",
                  },
                },
              },
            },
          },
        },
      });

      // Step 7: Project the necessary fields
      // Dynamically build the projection
      const productProjection = {};
      productColumns.forEach((col) => {
        if (PRODUCT_ARRAY_COLUMNS.includes(col)) productProjection[col] = 1;
        else productProjection[col] = `$product.${col}`;
      });

      const variantProjection = {};
      variantColumns.forEach((col) => {
        variantProjection[col] = `$${col}`; // Access fields directly in the Variant model
      });

      // Combine product and variant projections into a flat structure
      const flatProjection = {
        ...productProjection,
        ...variantProjection,
        category: 1,
        prodCategory: "$sharedAttributes.category",
        anothCategory: "$product.category",
        sharedAttrId: "$sharedAttributes._id",
        productId: "$product._id", // Always include product ID
        _id: 1, // Always include the Variant document ID
        itemId: 1,
        variantId: 1,
        itemType: 1,
        images: {
          $cond: {
            if: { $eq: [{ $size: { $ifNull: ["$variantImages", []] } }, 0] },
            then: "$product.images",
            else: "$variantImages",
          },
        },
      };

      pipeline.push({
        $project: flatProjection,
      });

      pipeline.push({ $sort: sortOptions });

      pipeline.push({
        $facet: {
          totalItems: [{ $count: "count" }],
          variants: [{ $skip: skip }, { $limit: limit }],
        },
      });

      // Step 8: Execute the aggregation pipeline
      const [results] = await ItemModel.aggregate(pipeline).exec();
      // Step 9: Transform the output to the desired structure

      // Step 10: Calculate total pages
      const totalItems = results?.totalItems?.[0]?.count || 0;
      const totalPages = Math.ceil(totalItems / limit);
      // Step 11: Return the paginated and transformed results
      return {
        items: results?.variants,
        totalItems,
        totalPages,
        currentPage: page,
      };
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      throw error;
    }
  }

  async searchProductsDBV3(
    pageNumber,
    pageSize,
    status,
    supplierCustomId,
    searchText,
    itemTypes,
    excludeOnDemandKit,
    sortOptions = { createdAt: 1 }
  ) {
    try {
      // Initialize the aggregation pipeline
      const pipeline = [];
      // Step 1: Lookup to join Product data
      pipeline.push({
        $lookup: {
          from: "itemshareds", // The name of the Product collection
          localField: "sharedAttributes", // Field in Variant collection
          foreignField: "_id", // Field in Product collection
          as: "sharedAttributes", // Output array field
        },
      });

      // Step 2: Unwind the joined Product array to object
      pipeline.push({ $unwind: "$sharedAttributes" });

      if (!excludeOnDemandKit) {
        // Add lookup for billOfMaterial
        pipeline.push(
          // Unwind the billOfMaterial array
          {
            $unwind: {
              path: "$billOfMaterial",
              preserveNullAndEmptyArrays: true,
            },
          },
          // Lookup the variant item
          {
            $lookup: {
              from: "items", // Collection name
              localField: "billOfMaterial.variant_id",
              foreignField: "_id",
              pipeline: [
                { $project: { _id: 1, variantId: 1, totalQuantity: 1 } }, // Only include what you need
              ],
              as: "variantDetails",
            },
          },
          // Extract the single matched variant
          {
            $addFields: {
              variant: { $arrayElemAt: ["$variantDetails", 0] },
            },
          },
          // Reformat billOfMaterial item
          {
            $addFields: {
              billOfMaterial: {
                variant: "$variant",
              },
            },
          },
          // Group back
          {
            $group: {
              _id: "$_id",
              doc: { $first: "$$ROOT" },
              billOfMaterial: { $push: "$billOfMaterial" },
            },
          },
          // Restore original doc with modified billOfMaterial
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: ["$doc", { billOfMaterial: "$billOfMaterial" }],
              },
            },
          }
        );
      }

      // Step 1: Build the match criteria based on input filters
      const match = {};

      if (itemTypes) {
        match["itemType"] = { $in: itemTypes };
      }

      if (["true", true].includes(excludeOnDemandKit)) {
        match["kitAssemblyType"] = { $ne: KIT_ASSEMBLY_TYPE.onDemand };
      }

      // Apply searchText filter on variantDescription with case-insensitive regex
      if (searchText) {
        const escapedSearchText = escapeRegExp(searchText);
        match["variantDescription"] = {
          $regex: escapedSearchText,
          $options: "i",
        };
      }

      // Apply supplierCustomId filter based on product's supplierId
      if (supplierCustomId) {
        match["sharedAttributes.supplierId"] = supplierCustomId;
      }

      // Apply status filter based on product's status
      if (status && status.length > 0) {
        match["status"] = { $in: status };

        if (status.includes(ITEM_STATUS.active)) {
          match["sharedAttributes.status"] = { $in: status };
        }
      }

      // Add the match stage if there are any criteria
      if (Object.keys(match).length > 0) {
        pipeline.push({ $match: match });
      }

      // Step 3: Unwind sharedAttributesData (if needed)

      // Step 4: Count total items matching the criteria
      const countPipeline = [...pipeline, { $count: "totalItems" }];
      const countResult = await ItemModel.aggregate(countPipeline).exec();
      const totalItems = countResult[0] ? countResult[0].totalItems : 0;

      // Step 5: Sort the results
      if (sortOptions && Object.keys(sortOptions).length > 0) {
        pipeline.push({ $sort: sortOptions });
      }

      // Step 6: Implement pagination (skip and limit)
      const skip = (pageNumber - 1) * pageSize;
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: pageSize });

      // Step 7: Project the necessary fields
      pipeline.push({
        $project: {
          _id: 1,
          productId: "$sharedAttributes._id",
          supplierPartNumber: 1,
          images: {
            $cond: {
              if: { $eq: [{ $size: { $ifNull: ["$variantImages", []] } }, 0] },
              then: "$sharedAttributes.images",
              else: "$variantImages",
            },
          },
          description: "$variantDescription",
          itemType: 1,
          supplierName: "$sharedAttributes.supplierName",
          supplierCustomId: "$sharedAttributes.supplierId",
          variantId: 1,
          unitType: 1,
          purchaseUnits: 1,
          salesUnits: 1,
          price: "$purchasePrice",
          sellingPrice: 1,
          leadTime: 1,
          leadTimeUnit: 1,
          qtyAtHand: "$totalQuantity",
          billOfMaterial: excludeOnDemandKit ? 0 : 1,
        },
      });

      // Step 8: Execute the aggregation pipeline
      const products = await ItemModel.aggregate(pipeline).exec();

      // Step 10: Calculate total pages
      const totalPages = Math.ceil(totalItems / pageSize);
      //console.log(transformedProd)
      // Step 11: Return the paginated and transformed results
      if (excludeOnDemandKit)
        return {
          products,
          totalItems,
          totalPages,
          currentPage: pageNumber,
        };

      const itemsWithOnDemandKits = products.map((product) => {
        if (
          !product.billOfMaterial ||
          product.billOfMaterial.length === 0 ||
          Object.keys(product.billOfMaterial[0]).length === 0
        ) {
          return product;
        }

        const bOMItemQuantities = product.billOfMaterial.map((bomItem) => {
          const bomItemTotalQuantity = getTotalQuantityForAllWarehouses(
            bomItem.variant.totalQuantity
          );

          return Math.floor(bomItemTotalQuantity / bomItem.quantity);
        });

        return {
          ...product,
          kitQuantity: Math.min(...bOMItemQuantities),
        };
      });

      return {
        products: itemsWithOnDemandKits,
        totalItems,
        totalPages,
        currentPage: pageNumber,
      };
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  }

  async fetchAllProductNames(sortOptions = { createdAt: 1 }) {
    let query = {};
    let projection = { productName: 1 };
    try {
      const products = await ItemSharedAttributesModel.find(
        query,
        projection
      ).sort(sortOptions);
      return products.map((product) => product.productName);
    } catch (error) {
      console.error("Error fetching warehouse data:", error);
      throw error;
    }
  }
  // Get specific product
  async fetchProductByKey(key) {
    try {
      const prodData = await ItemSharedAttributesModel.findById(key)
        .populate({
          path: "variants",
          //select: 'totalQuantity productSKU productColor productSize', // Specify fields to include from Variant
        })
        .lean(); // Optional: Use lean() for faster read operations and plain JavaScript objects

      if (!prodData) {
        console.warn(`Product with ID ${key} not found.`);
        return null; // Or handle as per your application's requirement
      }

      return prodData;
    } catch (error) {
      console.error("Error fetching product by ID:", error);
      throw error;
    }
  }

  async fetchSupplierByKey(key) {
    const suppData = await SupplierModel.findById(key);
    return suppData;
  }
  async fetchSupplierByCustomId(key) {
    const suppData = await SupplierModel.findOne(key);
    return suppData;
  }

  // *# Lists for products

  // Add a new list type
  async addItemList(payload) {
    const doc = new ProductListsModel(payload);
    let addedData = doc.save();
    return addedData;
  }
  // Get All lists
  async getAllItemsList(
    stringsOfKeys,
    sortOptions = { createdAt: 1 }
    //hasLabelValue = false
  ) {
    try {
      // Split the keys into an array
      let keyArray = stringsOfKeys.keys.split(",");

      // Define the aggregation pipeline
      const sortedLists = await ProductListsModel.aggregate([
        // Stage 1: Match documents with keys in keyArray
        { $match: { key: { $in: keyArray } } },

        // Stage 2: Sort the 'data' array within each document by 'label' in ascending order
        {
          $addFields: {
            data: {
              $cond: {
                if: { $eq: ["$hasLabelValue", true] }, // Check if hasLabelValue is true
                then: "$labelValue", // If true, use the labelValue field
                else: {
                  $sortArray: {
                    input: "$data", // If false, use the original data field and sort it
                    sortBy: { label: 1 }, // Sort by label (ascending)
                  },
                },
              },
            },
          },
        },

        // Stage 3: Sort the documents themselves based on sortOptions
        { $sort: sortOptions },

        // (Optional) Stage 4: Project only necessary fields
        {
          $project: {
            _id: 1,
            key: 1,
            data: 1,
            status: 1,
            hasLabelValue: 1, // Include this in case you need to inspect it later
            // Exclude other fields if necessary
          },
        },
      ]);

      return sortedLists;
    } catch (error) {
      console.error("Error fetching and sorting ProductLists:", error);
      throw error; // Re-throw the error after logging
    }
  }

  // Get all keys of lists
  async getAllItemsListKeys(offset, limit, sortOptions = { createdAt: 1 }) {
    let projection = { _id: 1, key: 1, hasLabelValue: 1 };
    const List = await ProductListsModel.find({}, projection).sort(sortOptions);
    return List;
  }
  // Find a specific list
  async getSpecificItem(itemKey) {
    //let projection = { _id: 1, key: 1, data: 1, status: 1 };
    const item = await ProductListsModel.findById(itemKey);
    let newItem = item.toObject();
    delete newItem.activity;
    delete newItem.__v;
    return newItem;
  }
  async getSpecificItemForUpdate(itemKey) {
    //let projection = { _id: 1, key: 1, data: 1, status: 1 };
    const item = await ProductListsModel.findById(itemKey);

    return item;
  }
  // Add an item to list
  async updateList(item) {
    let saved = await item.save();
    return saved;
  }

  // *# Suplier data
  async saveSupplierToDB(payload) {
    // SupplierModel.collection.indexes().then((indexes) => console.log(indexes));
    const newSupplierDoc = new SupplierModel(payload);
    const savedSupplier = await newSupplierDoc.save();
    let newSupplier = savedSupplier.toObject();
    delete newSupplier.__v;
    delete newSupplier.activity;
    return savedSupplier;
  }
  async saveManySuppliers(suppliers) {
    const session = await SupplierModel.startSession();
    session.startTransaction();
    try {
      // Save all suppliers first
      await SupplierModel.insertMany(suppliers, { session });

      await session.commitTransaction();
      session.endSession();

      return true;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
  // Generate unique ID for supplier
  async generateUniqueId() {
    const prefix = "SUP";
    let uniqueId;
    let isUnique = false;

    while (!isUnique) {
      // Generate a random 4-digit number (you can customize this logic)
      const randomNumber = Math.floor(1000 + Math.random() * 9000);
      uniqueId = `${prefix}${randomNumber}`;

      // Check if this ID already exists in the database
      const existingDocument = await SupplierModel.findOne({
        customId: uniqueId,
      });
      if (!existingDocument) {
        isUnique = true; // No duplicates found, it's safe to use
      }
    }

    return uniqueId;
  }
  // Search supplier using text
  async searchSuppliersText(payload) {
    const escapedSearchText = escapeRegExp(payload.searchText);
    const regexPattern = new RegExp(`${escapedSearchText}`, "i");
    const result = await SupplierModel.find(
      {
        [payload.searchKey]: { $regex: regexPattern },
      },
      {
        _id: 1,
        customId: 1,
        name: 1,
      }
    );

    return result;
  }

  // Get all Suppliers
  async fetchSuppliersDB(
    pageNumber,
    pageSize,
    columnsJson,
    filters,
    sortOptions
  ) {
    const skip = (pageNumber - 1) * pageSize;
    const { status, ...restFilters } = filters;

    // Initialize aggregation pipeline
    const pipeline = [];

    // Apply the filters
    const match = {};

    if (status && status.length > 0) {
      match["status"] = { $in: status };
    } else {
      match["status"] = { $ne: SUPPLIER_STATUSES.DELETED };
    }

    // Add other filters
    for (const [key, value] of Object.entries(restFilters)) {
      if (key === "currency") {
        const parsedFilter = parseArrayFilter(value);
        if (parsedFilter) {
          match[`${key}.value`] = {
            [`$${parsedFilter.operator}`]: parsedFilter.value,
          };
        }
      } else if (SUPPLIER_DATE_RANGE_FILTER_COLUMNS.includes(key)) {
        const parsedFilter = parseDateRangeFilter(value);
        if (parsedFilter) {
          const { startDate, endDate } = parsedFilter;
          match[key] = {
            $gte: startDate.getTime(),
            $lte: endDate.getTime(),
          };
        }
      } else if (SUPPLIER_TEXT_FILTER_COLUMNS.includes(key)) {
        const escapedSearchText = escapeRegExp(value);
        match[key] = {
          $regex: escapedSearchText,
          $options: "i",
        };
      } else if (SUPPLIER_ARRAY_FILTER_COLUMNS.includes(key)) {
        const parsedFilter = parseArrayFilter(value);
        if (parsedFilter) {
          match[key] = {
            [`$${parsedFilter.operator}`]: parsedFilter.value,
          };
        }
      }
    }

    pipeline.push({ $match: match });

    pipeline.push({ $sort: sortOptions });

    pipeline.push({
      $project: {
        ...columnsJson,
        activity: { $arrayElemAt: ["$activity", -1] },
      },
    });

    pipeline.push({
      $facet: {
        totalItems: [{ $count: "count" }], // Count filtered items
        suppliers: [{ $skip: skip }, { $limit: pageSize }],
      },
    });

    try {
      const [filteredResult, dbTotalItems] = await Promise.all([
        SupplierModel.aggregate(pipeline).exec(),
        SupplierModel.countDocuments({
          status: { $ne: SUPPLIER_STATUSES.DELETED },
        }).exec(),
      ]);

      const totalItems = filteredResult[0]?.totalItems?.[0]?.count || 0;

      return {
        suppliers: filteredResult[0]?.suppliers,
        totalItems,
        dbTotalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: pageNumber,
      };
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      throw error;
    }
  }

  async searchSuppliersDB(
    pageNumber,
    pageSize,
    searchText,
    status,
    sortOptions = { createdAt: 1 }
  ) {
    //
    let query = {};
    if (status && status.length > 0) {
      query.status = { $in: status };
    }

    if (searchText) {
      const escapedSearchText = escapeRegExp(searchText);
      const regexPattern = new RegExp(`${escapedSearchText}`, "i");
      query.name = { $regex: regexPattern };
      // if(searchKey === 'name'){
      // }
      // else{
      //   query.customId = {$regex: regexPattern}
      // }
    }

    // Projection to inxclude sensitive fields
    let projection = {
      _id: 1,
      name: 1,
      customId: 1,
      contactInfo: 1,
      currency: 1,
      paymentTerms: 1,
    };
    try {
      // Count total items matching the query
      const totalItems = await SupplierModel.countDocuments(query);

      // Find users with pagination and sorting
      let suppliers = await SupplierModel.find(query, projection)
        .sort(sortOptions)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean();
      return {
        suppliers: suppliers,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: pageNumber,
      };
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  }
  // Update supplier
  async updateSupplierDb(key, payload, activity) {
    const SupplierData = await SupplierModel.findByIdAndUpdate(
      key,
      {
        $set: payload,
        $push: { activity },
      },
      { new: true, runValidators: true }
    ); // Returns the updated document
    return SupplierData;
  }
  async bulkUpdateSuppliers(data) {
    const results = [];

    // Prepare the bulk operations
    const bulkOps = data.map((item) => {
      const {
        _id,
        customId,
        updatedAt,
        data: { status, activity },
      } = item;

      // Build the update object
      let updateFields = {
        status: status,
      };
      // if (action === "role") updateFields.userRole = value;
      // if (action === "status") updateFields.status = value;

      // Add the activity push operation
      let updateOperation = {
        $set: updateFields,
        $push: { activity: activity },
      };

      return {
        updateOne: {
          filter: { _id },
          update: updateOperation,
          runValidators: true,
        },
        customId,
        updatedAt,
      };
    });
    // Execute the bulk operations in a try-catch block to handle errors for each operation
    for (const op of bulkOps) {
      const { filter } = op.updateOne;
      try {
        await SupplierModel.bulkWrite([op]);
        results.push({
          _id: filter._id,
          customId: op.customId,
          updatedAt: op.updatedAt,
          success: true,
        });
      } catch (error) {
        console.error(
          "Error performing bulk update for key:",
          filter._id,
          error
        );
        results.push({ _id: filter._id, success: false, error: error.message });
      }
    }

    return results;
  }
  async fetchSupplierById(supplierKey) {
    // Not adding these fields to compare payloads
    let projection = {
      activity: 0,
      __v: 0,
      createdAt: 0,
      updatedAt: 0,
      "shippingAddress._id": 0,
      "billingAddress._id": 0,
      "contactInfo._id": 0,
    };
    try {
      // Find users with pagination and sorting
      const supplier = await SupplierModel.findById(supplierKey, projection);
      return supplier;
    } catch (error) {
      console.error("Error fetching supplier:", error);
      throw error;
    }
  }
  async fetchManySupplierByIds(Ids) {
    try {
      const users = await SupplierModel.find({ _id: { $in: Ids } })
        .select("_id name customId shippingAddress contactInfo") // Select only necessary fields
        .lean()
        .exec();

      // Create a mapping from userId to user data
      const userMap = {};
      users.forEach((user) => {
        userMap[user._id.toString()] = user;
      });

      return userMap;
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      throw error;
    }
  }
  // *# ABC class
  // Add ABC Class data
  async saveABCClassToDB(payload) {
    const newClassDoc = new ABCClassificatonModel(payload);
    const savedClass = await newClassDoc.save();
    let newClass = savedClass.toObject();
    delete newClass.__v;
    delete newClass.activity;
    return newClass;
  }
  // Get All ABC Classes
  async fetchABCClassDB(
    pageNumber,
    pageSize,
    columnsJson,
    filters,
    sortOptions = { createdAt: 1 }
  ) {
    //
    let query = {};
    if ("name" in filters) {
      if (filters.name === "") delete filters.name;
      else {
        // add regex logic to name
        const escapedSearchText = escapeRegExp(filters.name);
        const regexPattern = new RegExp(`${escapedSearchText}`, "i");
        query.name = { $regex: regexPattern };
        delete filters.name;
      }
    }
    // iterate over the object and add keys to query
    for (const [key, value] of Object.entries(filters)) {
      query[key] = { $in: value };
    }
    //console.log('QUERY',query)
    // Projection to exclude sensitive fields
    let projection = {
      ...columnsJson,
    };
    try {
      const includeActivity = Object.prototype.hasOwnProperty.call(
        columnsJson,
        "activity"
      );
      if (includeActivity) projection.status = 1;
      // Count total items matching the query
      const totalItems = await ABCClassificatonModel.countDocuments(query);

      // Find users with pagination and sorting
      let abcClasses = await ABCClassificatonModel.find(query, projection)
        .sort(sortOptions)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean();
      let filteredABCs = sortActivityArray(abcClasses);
      return {
        abcClasses: filteredABCs,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: pageNumber,
      };
    } catch (error) {
      console.error("Error fetching ABCs:", error);
      throw error;
    }
  }
  async fetchABCById(key) {
    try {
      const data = await ABCClassificatonModel.findById(key);
      return data;
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      return null;
    }
  }
  async updateABCDb(payload) {
    const savedClass = await payload.save();
    return savedClass;
  }
  async updateABCStatusDb(key, payload, activity) {
    const dataUpdated = await ABCClassificatonModel.findByIdAndUpdate(
      key,
      {
        $set: payload,
        $push: { activity },
      },
      { new: true, runValidators: true }
    ); // Returns the updated document
    return dataUpdated;
  }
  async bulkUpdateabcClasss(data) {
    const results = [];

    // Step 1: Extract all _ids from data for bulk fetching
    const ids = data.map((item) => item._id);

    // Step 2: Fetch existing documents in bulk
    const existingDocs = await ABCClassificatonModel.find({
      _id: { $in: ids },
    }).lean();
    const existingDocsMap = new Map(
      existingDocs.map((doc) => [doc._id.toString(), doc])
    );

    // Arrays to hold bulk operations and to track operations that failed validation
    const validBulkOps = [];
    const validationErrors = [];

    // Step 3: Iterate through each data item to prepare operations
    for (const item of data) {
      const {
        _id,
        updatedAt,
        data: { status, activity },
      } = item;
      const existingDoc = existingDocsMap.get(_id.toString());

      // Initialize update fields
      let updateFields = { status };

      // Initialize update operations
      // let updateOperation = {
      //   $set: updateFields,
      //   $push: { activity: activity },
      // };

      // Validation if status is 'active'
      if (status === "active") {
        if (!existingDoc) {
          // If the document doesn't exist and upsert is true, create a new document object
          // Note: Depending on your schema, you might need to provide all required fields
          const newDocData = {
            _id,
            status,
            activity: [activity],
            updatedAt: updatedAt || Date.now(),
            // Add other required fields with default or provided values
          };
          const tempDoc = new ABCClassificatonModel(newDocData);
          try {
            await tempDoc.validate();
            // If validation passes, prepare the upsert operation
            validBulkOps.push({
              updateOne: {
                filter: { _id },
                update: {
                  $set: { ...updateFields, updatedAt: Date.now() },
                  $push: { activity: activity },
                },
                upsert: true,
              },
            });
            results.push({ _id, updatedAt, success: true });
          } catch (validationError) {
            console.error("Validation error for _id:", _id, validationError);
            validationErrors.push({
              _id,
              success: false,
              error: validationError.message,
            });
          }
          continue; // Move to the next item
        }

        // Merge existing document with updates
        const mergedData = { ...existingDoc, ...updateFields };
        if (activity) {
          mergedData.activity = [...existingDoc.activity, activity];
        }

        // Create a temporary document for validation
        const tempDoc = new ABCClassificatonModel(mergedData);
        try {
          await tempDoc.validate();
          // If validation passes, include in bulk operations
          validBulkOps.push({
            updateOne: {
              filter: { _id },
              update: {
                $set: { ...updateFields, updatedAt: Date.now() },
                $push: { activity: activity },
              },
              upsert: true,
            },
          });
          results.push({ _id, updatedAt, success: true });
        } catch (validationError) {
          console.error("Validation error for _id:", _id, validationError);
          validationErrors.push({
            _id,
            success: false,
            error: validationError.message,
          });
        }
      } else {
        // If status is not 'active', no validation needed
        validBulkOps.push({
          updateOne: {
            filter: { _id },
            update: {
              $set: { ...updateFields, updatedAt: Date.now() },
              $push: { activity: activity },
            },
            upsert: true,
          },
        });
        results.push({ _id, updatedAt, success: true });
      }
    }

    // Step 4: Execute bulk operations if there are any valid operations
    if (validBulkOps.length > 0) {
      try {
        const bulkWriteResult = await ABCClassificatonModel.bulkWrite(
          validBulkOps,
          { ordered: false }
        );
        console.log("Bulk write result:", bulkWriteResult);
      } catch (bulkError) {
        console.error("Bulk write encountered an error:", bulkError);
        // Handle bulk write errors if necessary
        // Note: Individual operation errors are already handled
      }
    }

    // Step 5: Combine validation errors with successful results
    return [...results, ...validationErrors];
  }
  // *# Products
  async saveProductToDBV3(payload, variantsData, session) {
    //ItemModel.collection.indexes().then((indexes) => console.log("BEFORE",indexes))
    //await ItemSharedAttributesModel.collection.dropIndex("name_1");
    ItemSharedAttributesModel.collection
      .indexes()
      .then((indexes) => console.log("BEFORE", indexes));
    //return "ok";
    //await ItemModel.syncIndexes();
    try {
      let { itemType } = payload;
      const SharedModel = sharedModelLookup[itemType];
      const VariantModel = variantModelLookup[itemType];
      if (!SharedModel || !VariantModel) {
        throw new Error(`Unsupported itemType: ${itemType}`);
      }

      // Create the Product document
      const sharedData = new SharedModel(payload);
      await sharedData.save({ session });

      // Initialize an array to hold created Variant IDs
      let variantIds = [];
      let createdVariants = [];

      // If the product has variants, create them
      if (variantsData && variantsData.length > 0) {
        // Prepare Variant documents with a reference to the Product
        const variantDocs = variantsData.map((variant) => {
          return {
            ...variant,
            sharedAttributes: sharedData._id, // Reference to the parent Product
          };
        });
        // Insert all Variant documents in bulk
        createdVariants = await VariantModel.insertMany(variantDocs, {
          session,
        });

        // Extract the IDs of the created Variants
        variantIds = createdVariants.map((variant) => variant._id);

        const shopifyIntegration = await this.getIntegrationByKey("shopify");

        if (
          sharedData?.status === ITEM_STATUS.active &&
          shopifyIntegration.isActive &&
          shopifyIntegration.itemTypesToSync?.includes(itemType)
        ) {
          const shopifyFullProduct = {
            ...sharedData.toObject(),
            variants: createdVariants,
          };

          for (
            let variantIndex = 0;
            variantIndex < createdVariants.length;
            variantIndex++
          ) {
            if (createdVariants[variantIndex].status === ITEM_STATUS.active) {
              const shopifyPayload = getShopifyProductPayload(
                shopifyFullProduct,
                variantIndex,
                shopifyIntegration.fieldsToSync,
                ITEM_STATUS.draft
              );
              console.log("payload for shopify:", shopifyPayload);
              await createShopifyProduct(
                shopifyPayload,
                shopifyIntegration.storeDomain
              );
            }
          }
        }
      }

      // Update the Product document with the Variant references, if any
      if (variantIds.length > 0) {
        sharedData.variantIds = variantIds;
        await sharedData.save({ session });
      }
      // Commit the transaction

      //await session.commitTransaction();
      return { id: sharedData._id, itemType, createdVariants };
    } catch (error) {
      // If any error occurred, abort the transaction
      await session.abortTransaction();
      session.endSession();
      // Propagate the error to be handled by the caller
      throw error;
    }
  }
  async getSingleProductV3(id) {
    // console.log(itemType)
    // const SharedModel = sharedModelLookup[itemType];
    // if (!SharedModel) {
    //   throw new Error(`Unsupported itemType: ${itemType}`);
    // }
    return await ItemSharedAttributesModel.findById(id).populate("variantIds");
  }

  async fetchProductsDBV3(
    page,
    limit,
    columns,
    queryFilters,
    sortOptions = { createdAt: 1 }
  ) {
    const skip = (page - 1) * limit;
    const { itemType, ...filters } = queryFilters;

    // Separate parent and variant columns
    const parentColumns = columns.filter(
      (column) => !column.startsWith("variants.")
    );
    const variantColumns = columns
      .filter((column) => column.startsWith("variants."))
      .map((column) => column.replace("variants.", "")); // Remove `variants.` prefix

    // Initialize aggregation pipeline
    const pipeline = [];

    pipeline.push({
      $lookup: {
        from: "items", // Name of the variants collection
        localField: "variantIds",
        foreignField: "_id",
        as: "variants",
      },
    });

    const match = {};

    if (itemType) {
      match["itemType1"] = { $in: itemType.map((type) => type + "Common") };
    }

    for (const [key, value] of Object.entries(filters)) {
      if (PRODUCT_ARRAY_FILTER_COLUMNS.includes(key)) {
        const parsedFilter = parseArrayFilter(value);
        if (parsedFilter) {
          match[key] = {
            [`$${parsedFilter.operator}`]: parsedFilter.value,
          };
        }
      } else if (key === "countryOfOrigin") {
        const parsedFilter = parseArrayFilter(value);
        if (parsedFilter) {
          match[`${key}.value`] = {
            [`$${parsedFilter.operator}`]: parsedFilter.value,
          };
        }
      } else if (PRODUCT_DATE_RANGE_FILTER_COLUMNS.includes(key)) {
        const parsedFilter = parseDateRangeFilter(value);
        if (parsedFilter) {
          const { startDate, endDate } = parsedFilter;
          match[key] = {
            $gte: startDate.getTime(),
            $lte: endDate.getTime(),
          };
        }
      } else if (PRODUCT_TEXT_FILTER_COLUMNS.includes(key)) {
        if (value) {
          const escapedSearchText = escapeRegExp(value);
          match[key] = {
            $regex: escapedSearchText,
            $options: "i",
          };
        }
      } else match[key] = { $in: value };
    }

    if (!match.status || match.status.length === 0) {
      match.status = { $ne: ITEM_STATUS.deleted };
    }

    pipeline.push({ $match: match });

    pipeline.push({
      $addFields: {
        ...convertParentArrayColumnsToString(parentColumns),
        activity: { $arrayElemAt: ["$activity", -1] },
      },
    });

    const parentProjection = {};
    parentColumns.forEach((col) => {
      parentProjection[col] = 1;
    });

    const variantProjection = {
      variants: {
        $map: {
          input: "$variants",
          as: "variant",
          in: variantColumns.reduce((acc, column) => {
            acc[column] = `$$variant.${column}`;
            return acc;
          }, {}),
        },
      },
    };

    const finalProjection = {
      ...parentProjection,
      ...variantProjection,
      _id: 1,
    };

    pipeline.push({ $project: finalProjection });

    pipeline.push({ $sort: sortOptions });

    pipeline.push({
      $facet: {
        totalItems: [{ $count: "count" }], // Count filtered items
        products: [{ $skip: skip }, { $limit: limit }],
      },
    });

    try {
      const [results, dbTotalItems] = await Promise.all([
        ItemSharedAttributesModel.aggregate(pipeline).exec(),
        ItemSharedAttributesModel.countDocuments({
          status: { $ne: ITEM_STATUS.deleted },
        }).exec(),
      ]);

      const totalItems = results[0]?.totalItems?.[0]?.count || 0;

      return {
        products: results[0]?.products,
        totalItems, // Count of items matching filters
        dbTotalItems, // Count of all non-deleted items
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  }

  async fetchProductByKeyV3(key) {
    try {
      //TYPE 1 = "Products"
      // Products.collection.indexes().then((indexes) => console.log("BEFORE",indexes))
      //await ItemModel.collection.dropIndex("name_1");
      //await ItemModel.syncIndexes();
      // ItemModel.collection.indexes().then((indexes) => console.log("AFTER",indexes))
      // return (await ItemSharedAttributesModel.find({})).map((product) => {
      //   product.variantIds.map(async (variantid) => {
      //     const variant = await ItemModel.findById(variantid);
      //     console.log("variant", variant.leadTime);
      //     if (!variant) return;
      //     if (variant.status === "deleted") return;
      //     if (typeof variant.leadTime === "string") {
      //       if (variant.leadTime === "" || variant.leadTime === null)
      //         variant.leadTime = null;
      //       else variant.leadTime = Number(variant.leadTime);
      //     }
      //     await variant.save();
      //     //console.log("after save", variant);
      //   });
      // });
      // const items = await ItemModel.find({});
      // for (const item of items) {
      //   let updated = false;

      //   if (item.storageLocations instanceof Map) {
      //     for (const warehouseId of item.storageLocations.keys()) {
      //       const locations = item.storageLocations.get(warehouseId);
      //       if (Array.isArray(locations) && locations.length > 0) {
      //         item.storageLocations.set(warehouseId, []); // Clear the array
      //         updated = true;
      //       }
      //     }

      //     item.markModified('storageLocations');
      //   }

      //   // if (item.totalQuantity) {
      //   //   for (const warehouseId of Object.keys(item.totalQuantity)) {
      //   //     if (item.totalQuantity[warehouseId] !== 0) {
      //   //       item.totalQuantity[warehouseId] = 0;
      //   //       updated = true;
      //   //     }
      //   //   }
      //   // }

      //   if (updated) {
      //     //item.markModified('totalQuantity');
      //     await item.save();
      //   }
      // }
      // return items

      const prodData = await ItemSharedAttributesModel.findById(key)
        .populate([
          {
            path: "variantIds",
            select: "-inventoryLogs",
            populate: {
              path: "billOfMaterial.variant_id",
              model: "Item",
              select:
                "variantImages variantDescription supplierPartNumber variantId itemType unitType",
              populate: {
                path: "sharedAttributes", // Nested population inside relatedItems
                select: "supplierId supplierName productId", // Specify fields to include (optional)
              },
            },
          },
          {
            path: "relatedItems",
            select:
              "variantImages variantDescription supplierPartNumber variantId itemType",
            populate: {
              path: "sharedAttributes", // Nested population inside relatedItems
              select: "supplierId supplierName productId", // Specify fields to include (optional)
            },
          },
        ])
        .lean(); // Optional: Use lean() for faster read operations and plain JavaScript objects

      if (!prodData) {
        console.warn(`Product with ID ${key} not found.`);
        return null; // Or handle as per your application's requirement
      }
      // Restructure relatedItems: flatten sharedAttributes and remove the original key
      if (prodData?.relatedItems) {
        prodData.relatedItems = prodData.relatedItems.map((item) => {
          return {
            _id: item._id,
            productId: item.sharedAttributes._id,
            variantId: item.variantId,
            supplierPartNumber: item.supplierPartNumber,
            images: item.variantImages,
            description: item.variantDescription,
            itemType: item.itemType,
            supplierName: item.sharedAttributes.supplierName,
          };
        });
      }
      if (prodData?.variantIds) {
        prodData.variants = prodData.variantIds.map((variant) => ({
          ...variant,
          billOfMaterial: variant.billOfMaterial
            ? variant.billOfMaterial.map((item) => {
                return {
                  _id: item.variant_id._id,
                  productId: item.variant_id.sharedAttributes._id,
                  variantId: item.variant_id.variantId,
                  supplierPartNumber: item.variant_id.supplierPartNumber,
                  images: item.variant_id.variantImages,
                  description: item.variant_id.variantDescription,
                  itemType: item.variant_id.itemType,
                  unitType: item.variant_id.unitType,
                  quantity: item.quantity,
                  supplierName: item.variant_id.sharedAttributes.supplierName,
                };
              })
            : [],
        }));
      }
      delete prodData.variantIds;
      // TODO add it to the main shared schema as well
      prodData.productHasVariants = prodData.variants[0].productHasVariants;
      return prodData;
    } catch (error) {
      console.error("Error fetching product by ID:", error);
      throw error;
    }
  }

  async updateItemSharedDB(itemSharedKey, payload, userInfo, session) {
    try {
      // Start the transaction
      session.startTransaction();
      // 1. Fetch the ItemShared document and populate the items
      const fetchItemShared = await ItemSharedAttributesModel.findOne({
        _id: itemSharedKey,
      })
        .populate("variantIds") // old "variants"
        .session(session)
        .lean();

      if (!fetchItemShared) {
        throw new Error("No Product document found");
      }

      // 2. Create activity log for the parent update
      const activity = createActivityLog(
        userInfo,
        "Product Updated",
        [payload.status || fetchItemShared.status, "updated"], // or any status changes you want to record
        []
      );

      // === (Optional) Handle any top-level image changes or removals here ===
      // let imagesToRemove = [];
      // if ("sharedImages" in payload) {
      //   imagesToRemove = findRemovedOldImages(payload.sharedImages, fetchItemShared.sharedImages);
      // }

      // 3. Detect if we are switching from multiple to single “variant” (items)
      //    In the old code, `productHasVariants` was a single boolean on the product.
      //    Now you might store that at the ItemShared level, or simply rely on the `Item` schema.
      //    Here we assume `payload.productHasVariants` on ItemShared, for example:

      const hasShiftedToUniqueVariant =
        payload.productHasVariants === false &&
        fetchItemShared.productHasVariants;
      // Gather IDs of items to remove (if shifting to single item)
      let itemsToRemoveVariantIds = [];
      if (hasShiftedToUniqueVariant && Array.isArray(payload.variants)) {
        // We keep only the first item’s variantId from the new payload
        const keepVariantId = payload.variants[0]?.variantId;
        itemsToRemoveVariantIds = fetchItemShared.variantIds
          .filter((item) => item.variantId !== keepVariantId)
          .map((item) => item.variantId);
      }

      // We'll separate the items into "to update" vs. "to add"
      let itemsToUpdatePayload = [];
      let itemsToAddPayload = [];

      // 4. If payload has item definitions
      if (Array.isArray(payload.variants) && payload.variants.length > 0) {
        // Sort out "new" vs. "update"
        for (const itemPayload of payload.variants) {
          if ("variantId" in itemPayload) {
            // item already has a variantId -> update it
            itemsToUpdatePayload.push(itemPayload);
          } else {
            // item has no variantId -> new item
            itemsToAddPayload.push(itemPayload);
          }
        }
      }

      // 5. Remove specified items (if any)
      if (itemsToRemoveVariantIds.length > 0) {
        await removeItems(itemsToRemoveVariantIds, session);

        // We also need to remove them from the `variantIds` array on ItemShared
        const removedItemObjectIds = fetchItemShared.variantIds
          .filter((item) => itemsToRemoveVariantIds.includes(item.variantId))
          .map((item) => item._id);

        await ItemSharedAttributesModel.updateOne(
          { _id: itemSharedKey },
          {
            $pull: { variantIds: { $in: removedItemObjectIds } },
          },
          { session }
        );
      }

      // 6. Update existing items
      if (itemsToUpdatePayload.length > 0) {
        await updateOldItems(itemsToUpdatePayload, userInfo, session);
      }

      // 7. Add new items
      if (itemsToAddPayload.length > 0) {
        // We get all current items to figure out suffix numbering
        const existingItems = await ItemModel.find({
          sharedAttributes: fetchItemShared._id,
        }).session(session);

        const suffixStart = getVariantSuffixNumber(
          existingItems,
          fetchItemShared.productId // same logic used in old code
        );
        const newlyCreatedItems = await createNewItems(
          itemsToAddPayload,
          fetchItemShared.productId,
          fetchItemShared._id, // parent's _id
          suffixStart,
          userInfo,
          session
        );

        // Add references in the parent’s `variantIds` array
        const newItemObjectIds = newlyCreatedItems.map((item) => item._id);
        await ItemSharedAttributesModel.updateOne(
          { _id: itemSharedKey },
          { $push: { variantIds: { $each: newItemObjectIds } } },
          { session }
        );

        // updating product has variants true if multiple variants
        await ItemModel.updateMany(
          { sharedAttributes: itemSharedKey }, // Filter condition
          { $set: { productHasVariants: true } } // Update operation
        );
      }

      // 8. Update the parent (ItemShared) with other payload fields
      const itemSharedUpdateData = { ...payload };

      // Remove "items" from direct update, since we handle them separately
      delete itemSharedUpdateData.variants;

      // Push activity onto the parent’s activity array
      const oldActivity = fetchItemShared.activity || [];
      itemSharedUpdateData.activity = [...oldActivity, activity];

      // If we’re tracking an `itemType1` or `variantCount` or `status`:
      // updating variants length
      const getVariantCount = await ItemModel.find({
        sharedAttributes: itemSharedKey,
      });
      itemSharedUpdateData.variantCount = getVariantCount.length;
      // Finally, do the update
      let itemType = fetchItemShared.variantIds[0].itemType;
      const SharedModel = sharedModelLookup[itemType];
      const VariantModel = variantModelLookup[itemType];
      if (!SharedModel || !VariantModel) {
        throw new Error(`Unsupported itemType: ${itemType}`);
      }

      const updatedItemShared = await SharedModel.findByIdAndUpdate(
        itemSharedKey,
        { $set: itemSharedUpdateData },
        { new: true, session, runValidators: true }
      )
        .populate("variantIds")
        .lean();

      if (!updatedItemShared) {
        throw new Error("Error updating Product");
      }

      const shopifyIntegration = await this.getIntegrationByKey("shopify");

      if (
        updatedItemShared?.status === ITEM_STATUS.active &&
        shopifyIntegration.isActive &&
        shopifyIntegration.itemTypesToSync?.includes(itemType)
      ) {
        const variants = updatedItemShared.variantIds;
        const shopifyFullProduct = {
          ...updatedItemShared.toObject(),
          variants,
        };

        for (
          let variantIndex = 0;
          variantIndex < variants.length;
          variantIndex++
        ) {
          if (variants[variantIndex].status === ITEM_STATUS.active) {
            const variant = variants[variantIndex];

            const existingShopifyItem = await getShopifyProductByTitle(
              variant.variantDescription,
              shopifyIntegration.storeDomain
            );
            console.log("existingShopifyItem:", existingShopifyItem);
            if (!existingShopifyItem) {
              const shopifyPayload = getShopifyProductPayload(
                shopifyFullProduct,
                variantIndex,
                shopifyIntegration.fieldsToSync,
                ITEM_STATUS.draft
              );
              console.log("payload for shopify:", shopifyPayload);

              await createShopifyProduct(
                shopifyPayload,
                shopifyIntegration.storeDomain
              );
            } else {
              const shopifyPayload = getShopifyProductPayload(
                shopifyFullProduct,
                variantIndex,
                shopifyIntegration.fieldsToSync,
                existingShopifyItem.status === "active"
                  ? ITEM_STATUS.active
                  : ITEM_STATUS.draft
              );

              await updateShopifyProduct(
                existingShopifyItem.id,
                shopifyPayload,
                shopifyIntegration.storeDomain
              );
              console.log("payload for shopify:", shopifyPayload);
            }
          }
        }
      }

      // 10. Build response object
      const responseData = {
        _id: updatedItemShared._id,
        activity: (updatedItemShared.activity || []).sort(
          (a, b) => b.date - a.date
        )[0],
        createdAt: updatedItemShared.createdAt,
        updatedAt: updatedItemShared.updatedAt,
        variants: (updatedItemShared.variantIds || []).map((itm) => ({
          _id: itm._id,
          variantId: itm.variantId,
          variantDescription: itm.variantDescription,
          createdAt: itm.createdAt,
          updatedAt: itm.updatedAt,
          activity: itm.activity,
          // etc...
        })),
      };

      return apiPayloadFormat(
        1,
        "success",
        "Updated product data",
        responseData
      );
    } catch (error) {
      // Roll back if transaction is still active
      if (session.inTransaction()) {
        await session.abortTransaction().catch((abortErr) => {
          console.error("Error aborting transaction:", abortErr);
        });
      }
      console.error("Error updating product:", error);
      return apiPayloadFormat(
        0,
        "error",
        error.message || "Error updating product",
        {}
      );
    }
  }

  async updateItemSharedStatusV3(itemSharedKey, newStatus, userInfo) {
    // let updateSchemaQuery = ItemModel.updateMany(
    //       {},
    //       [
    //         {
    //           $set: {
    //             storageLocations: {
    //               $arrayToObject: {
    //                 $map: {
    //                   input: { $objectToArray: "$storageLocations" },
    //                   as: "loc",
    //                   in: {
    //                     k: "$$loc.k",
    //                     v: {
    //                       $map: {
    //                         input: "$$loc.v",
    //                         as: "location",
    //                         in: {
    //                           $mergeObjects: [ { itemQuantity: 0 }, "$$location" ]
    //                         }
    //                       }
    //                     }
    //                   }
    //                 }
    //               }
    //             }
    //           }
    //         }
    //       ]
    //     );

    // return await updateSchemaQuery.exec();
    // Start a Mongoose session for transaction
    const session = await mongoose.startSession();

    try {
      // Start the transaction
      session.startTransaction();

      // 1. Fetch the ItemShared and populate its items (variantIds)
      const itemShared = await ItemSharedAttributesModel.findOne({
        _id: itemSharedKey,
      })
        .populate("variantIds")
        .session(session);

      if (!itemShared) {
        throw new Error("No ItemShared found with the provided key.");
      }

      // 2. Create activity log for the ItemShared status update
      const itemSharedActivity = createActivityLog(
        userInfo,
        "Product Status Updated", // or your custom label
        newStatus,
        []
      );

      // 3. Update the ItemShared's status and activity
      const updatedItemShared =
        await ItemSharedAttributesModel.findOneAndUpdate(
          { _id: itemSharedKey },
          {
            $set: { status: newStatus },
            $push: { activity: itemSharedActivity },
          },
          { new: true, session }
        );

      // 4. Get the IDs of the child Items (similar to old variantIds)
      const itemIds = itemShared.variantIds.map((item) => item._id);

      // 5. Determine the corresponding child status (if you have a mapping table)
      //    e.g.
      //    const newItemStatus = NEW_ITEM_STATUS_FROM_NEW_SHARED_STATUS[newStatus];
      //    Or simply reuse `newStatus` if that is your logic:
      const newItemStatus = newStatus; // or a mapped status

      // 6. Prepare bulk update for all child items
      if (itemIds.length > 0) {
        const bulkItems = ItemModel.collection.initializeUnorderedBulkOp({
          session,
        });

        itemIds.forEach((itemId) => {
          bulkItems.find({ _id: itemId }).updateOne({
            $set: { status: newItemStatus },
            $push: {
              activity: createActivityLog(
                userInfo,
                "Item Status Updated",
                newItemStatus,
                []
              ),
            },
          });
        });

        // Execute the bulk operation
        await bulkItems.execute();
      }

      // 7. Fetch updated items for response
      const updatedItems = await ItemSharedAttributesModel.find({
        _id: { $in: itemIds },
      })
        .session(session)
        .select(
          "_id variantId variantDescription status activity createdAt updatedAt"
        )
        .lean();

      // 8. Commit Transaction
      await session.commitTransaction();
      session.endSession();

      // 9. Build and return final response
      return apiPayloadFormat(
        1,
        "success",
        "ItemShared and Items status updated successfully.",
        {
          _id: updatedItemShared._id,
          status: updatedItemShared.status,
          activity: itemSharedActivity, // The newly created activity
          createdAt: updatedItemShared.createdAt,
          updatedAt: updatedItemShared.updatedAt,
          items: updatedItems, // formerly "variants"
        }
      );
    } catch (error) {
      // Abort if there's still an active transaction
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error("Error aborting transaction:", abortError);
        }
      }
      session.endSession();

      console.error("Error updating ItemShared status:", error);
      return apiPayloadFormat(
        0,
        "error",
        error.message || "Error updating ItemShared status.",
        {}
      );
    }
  }

  async duplicateProductV3(productKey, userInfo) {
    // Start a Mongoose session for transaction
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Fetch the original product by productKey with populated variants
      const originalProduct = await ItemSharedAttributesModel.findOne({
        _id: productKey,
      })
        .populate("variantIds")
        .session(session)
        .lean();

      if (!originalProduct) {
        throw new Error("No product found with the provided key.");
      }

      // Fetch all existing product names to generate a unique name
      const allProductNames = await ItemSharedAttributesModel.find({}, "name")
        .session(session)
        .lean();
      const existingNames = allProductNames.map((p) => p.name);
      const newProductName = duplicateProductName(
        originalProduct.name,
        existingNames
      );

      // Generate a new unique productId
      const previousId = await this.getPreviousId();
      const newProductId = generateNextProductId(previousId);

      // Create activity log for the product duplication
      const productActivity = createActivityLog(
        userInfo,
        `Product Duplicated from ${originalProduct.productId}`,
        "draft",
        []
      );

      // Prepare the duplicated product data
      const duplicatedProductData = {
        ...originalProduct,
        productId: newProductId,
        name: newProductName,
        status: ITEM_STATUS.draft,
        activity: [productActivity],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variantIds: [], // Will populate after creating duplicated variants
      };

      // Remove _id from the duplicated product data so a new one will be generated
      delete duplicatedProductData._id;

      const itemType = originalProduct.variantIds[0].itemType;
      const SharedModel = sharedModelLookup[itemType];
      const VariantModel = variantModelLookup[itemType];
      if (!SharedModel || !VariantModel) {
        throw new Error(`Unsupported itemType: ${itemType}`);
      }
      // Create a new Product document with the duplicated data
      const duplicatedProduct = new SharedModel(duplicatedProductData);
      duplicatedProduct.images = await duplicateS3Images(
        duplicatedProduct.images
      );
      duplicatedProduct.docs = await duplicateS3Images(duplicatedProduct.docs);

      // Save the duplicated Product document within the session
      const savedDuplicatedProduct = await duplicatedProduct.save({ session });

      // Initialize array to hold duplicated variants' ObjectIds
      const duplicatedVariantIds = [];

      // Iterate through each variant of the original product to duplicate
      for (let i = 0; i < originalProduct.variantIds.length; i++) {
        const originalVariant = originalProduct.variantIds[i];

        // Generate a new unique variantId
        const newVariantId = `${newProductId}${i + 1}`;
        const variantActivity = createActivityLog(
          userInfo,
          "Product Variant Duplicated",
          "draft",
          []
        );

        // Prepare the new variant data
        const newDupVar = { ...originalVariant };
        delete newDupVar._id; // Remove the original _id so a new one is generated

        // Set fields for the duplicated variant
        newDupVar.productId = newProductId;
        newDupVar.variantId = newVariantId;
        newDupVar.status = ITEM_STATUS.draft;
        newDupVar.unitTypebarcodeValue = "";
        newDupVar.purchaseUnitsbarcodeValue = "";
        newDupVar.salesUnitsbarcodeValue = "";
        newDupVar.activity = [variantActivity];
        newDupVar.storageLocations = [];
        newDupVar.sharedAttributes = savedDuplicatedProduct._id;
        newDupVar.SKU = "";
        newDupVar.totalQuantity = {};
        newDupVar.leadTime = null;
        newDupVar.safetyStockLevel = 0;
        newDupVar.reorderOrderPoint = 0;
        newDupVar.reorderQuantity = 0;
        newDupVar.minimumOrderQuantity = 0;
        newDupVar.createdAt = Date.now();
        newDupVar.updatedAt = Date.now();

        // duplicate variant images
        newDupVar.variantImages = await duplicateS3Images(
          newDupVar.variantImages
        );

        // Create a new Variant document
        const duplicatedVariant = new VariantModel(newDupVar);
        // Save the duplicated Variant document within the session
        const savedDuplicatedVariant = await duplicatedVariant.save({
          session,
        });

        // Add the duplicated variant's ObjectId to the array
        duplicatedVariantIds.push(savedDuplicatedVariant._id);
      }

      // Update the duplicated product's variants array with the newly created variant IDs
      await ItemSharedAttributesModel.findByIdAndUpdate(
        savedDuplicatedProduct._id,
        { variantIds: duplicatedVariantIds, updatedAt: Date.now() },
        { session }
      );

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Fetch the updated product data
      const updatedDuplicatedProduct = await ItemSharedAttributesModel.findById(
        savedDuplicatedProduct._id
      ).lean();

      // Fetch the duplicated variants
      const duplicatedVariants = await ItemModel.find({
        _id: { $in: duplicatedVariantIds },
      })
        .select(
          "_id variantId variantDescription status activity createdAt updatedAt"
        )
        .lean();

      // Prepare the response data
      const responseData = {
        _id: updatedDuplicatedProduct._id,
        productId: updatedDuplicatedProduct.productId,
        productName: updatedDuplicatedProduct.name,
        status: updatedDuplicatedProduct.status,
        activity: updatedDuplicatedProduct.activity.sort(
          (a, b) => b.date - a.date
        )[0], // Latest activity
        variants: duplicatedVariants,
        createdAt: updatedDuplicatedProduct.createdAt,
        updatedAt: updatedDuplicatedProduct.updatedAt,
        // Add other fields as needed
      };

      // Return success response
      return apiPayloadFormat(
        1,
        "success",
        "Product duplicated successfully.",
        responseData
      );
    } catch (error) {
      // If an error occurred, abort the transaction if it's active
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error("Error aborting transaction:", abortError);
        }
      }
      session.endSession();
      console.error("Error duplicating product:", error);

      // Return error response
      return apiPayloadFormat(
        0,
        "error",
        error.message || "Error duplicating product.",
        {}
      );
    }
  }

  // Variant endpoints
  async getManyProductsUsingVId(
    objectIds,
    variant_ids,
    descriptionArray,
    skus,
    statusArray,
    columnsArray
  ) {
    const toObjectIdArray = (arr) =>
      Array.isArray(arr)
        ? arr.map((id) => new mongoose.Types.ObjectId(id))
        : [];
    // Build query object conditionally
    const query =
      objectIds?.length > 0
        ? {
            variantId: { $in: objectIds },
          }
        : descriptionArray?.length > 0
        ? {
            variantDescription: { $in: descriptionArray },
          }
        : skus?.length > 0
        ? { SKU: { $in: skus } }
        : {
            _id: { $in: toObjectIdArray(variant_ids) },
          };
    // Only add status filter if statusArray has values
    if (statusArray && statusArray.length > 0) {
      query.status = { $in: statusArray };
    }

    try {
      if (columnsArray && columnsArray.length > 0) {
        const pipeline = [];

        pipeline.push({
          $match: query,
        });

        pipeline.push({
          $lookup: {
            from: "itemshareds", // The name of the Product collection
            localField: "sharedAttributes", // Field in Variant collection
            foreignField: "_id", // Field in Product collection
            as: "product", // Output array field
          },
        });

        pipeline.push({
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true,
          },
        });

        const includeBOM = columnsArray.some((col) =>
          col.startsWith("billOfMaterial.")
        );

        if (includeBOM) {
          // the field to populate should look like "billOfMaterial.variant.totalQuantity"
          const billOfMaterialProjection = columnsArray
            .filter((col) => col.startsWith("billOfMaterial."))
            .reduce((acc, col) => {
              const field = col.split(".").at(-1);
              acc[field] = 1;
              return acc;
            }, {});

          // Add lookup for billOfMaterial
          pipeline.push(
            // Unwind the billOfMaterial array
            {
              $unwind: {
                path: "$billOfMaterial",
                preserveNullAndEmptyArrays: true,
              },
            },
            // Lookup the variant item
            {
              $lookup: {
                from: "items", // Collection name
                localField: "billOfMaterial.variant_id",
                foreignField: "_id",
                pipeline: [
                  { $project: billOfMaterialProjection }, // Only include what you need
                ],
                as: "variantDetails",
              },
            },
            // Extract the single matched variant
            {
              $addFields: {
                variant: { $arrayElemAt: ["$variantDetails", 0] },
              },
            },
            // Reformat billOfMaterial item
            {
              $addFields: {
                billOfMaterial: {
                  variant: "$variant",
                },
              },
            },
            // Group back
            {
              $group: {
                _id: "$_id",
                doc: { $first: "$$ROOT" },
                billOfMaterial: { $push: "$billOfMaterial" },
              },
            },
            // Restore original doc with modified billOfMaterial
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: [
                    "$doc",
                    { billOfMaterial: "$billOfMaterial" },
                  ],
                },
              },
            }
          );
        }

        // Project stage
        pipeline.push({
          $project: {
            ...columnsArray.reduce((acc, col) => {
              if (col.startsWith("billOfMaterial.")) return acc;
              if (VARIANT_ATTRIBUTES.includes(col)) {
                // Direct access for variant attributes
                acc[col] = 1;
              } else {
                // Access from product for non-variant attributes
                acc[col] = `$product.${col}`;
              }
              return acc;
            }, {}),
            _id: 1, // Always include _id,
            productId: "$product._id",
            billOfMaterial: includeBOM ? 1 : undefined,
            images: {
              $cond: {
                if: {
                  $eq: [{ $size: { $ifNull: ["$variantImages", []] } }, 0],
                },
                then: "$product.images",
                else: "$variantImages",
              },
            },
          },
        });
        const variants = await ItemModel.aggregate(pipeline).exec();
        return variants;
      } else {
        const variants = await ItemModel.find(query, {
          _id: 1,
          variantId: 1,
          supplierPartNumber: 1,
          variantImages: 1,
          purchasePrice: 1,
          purchaseUnits: 1,
          unitType: 1,
          salesUnits: 1,
          sellingPrice: 1,
          totalQuantity: 1,
          variantDescription: 1,
          leadTime: 1,
          leadTimeUnit: 1,
          sharedAttributes: 1, // Include the product reference
          serialNumber: 1,
          weight: 1,
          weightUnit: 1,
          length: 1,
          width: 1,
          height: 1,
          lengthUnit: 1,
          storageLocations: 1,
          unitTypebarcodeValue: 1,
          itemType: 1,
        })
          .populate(
            "sharedAttributes",
            "inspectionRequirements serialTracking lotTracking supplierName supplierId images"
          ) // Populate the product field with only the inspectionRequirements
          .lean(); // Use .lean() for plain JavaScript objects
        console.log(variants);
        if (variants.length > 0) {
          // Transform data to the required structure
          const matchedVariants = variants
            .filter((variant) => variant && variant._id)
            .map((variant) => ({
              productId: variant.sharedAttributes?._id, // The product's ObjectId
              _id: variant._id,
              unitType: variant.unitType,
              purchaseUnits: variant.purchaseUnits,
              salesUnits: variant.salesUnits,
              sellingPrice: variant.sellingPrice,
              variantId: variant.variantId,
              supplierPartNumber: variant.supplierPartNumber,
              images:
                variant.variantImages.length > 0
                  ? variant.variantImages
                  : variant.sharedAttributes.images,
              price: variant.purchasePrice,
              qtyAtHand: variant.totalQuantity,
              description: variant.variantDescription,
              leadTime: variant.leadTime,
              productWeight: variant.weight,
              weightUnit: variant.weightUnit,
              productLength: variant.length,
              productWidth: variant.width,
              productHeight: variant.height,
              lengthUnit: variant.lengthUnit,
              leadTimeUnit: variant.leadTimeUnit,
              serialNumber: variant.serialNumber,
              supplierName: variant.sharedAttributes.supplierName,
              supplierCustomId: variant.sharedAttributes.supplierId,
              inspectionRequirements:
                variant.sharedAttributes.inspectionRequirements,
              serialTracking: variant.sharedAttributes.serialTracking,
              lotTracking: variant.sharedAttributes.lotTracking,
              storageLocations: variant.storageLocations,
              // This value will have to be computed if auto-generate checkbox is checked
              baseUOMBarcodeValue: variant.unitTypebarcodeValue,
              itemType: variant.itemType,
            }));
          console.log(matchedVariants);
          return matchedVariants;
        } else {
          console.log("No variants found!");
          return [];
        }
      }
    } catch (error) {
      console.error("Error fetching variants:", error);
      throw error;
    }
  }
  async fetchProductsDBByQueryV3(page, limit, itemColumns, filters) {
    const allItemsByType = await ItemModel.aggregate([
      {
        $match: filters, // Apply filters to ItemModel
      },
      {
        $lookup: {
          // Populate sharedAttributes
          from: "itemshareds",
          localField: "sharedAttributes",
          foreignField: "_id",
          as: "sharedAttributes",
        },
      },
      {
        $unwind: "$sharedAttributes",
      },
      {
        $group: {
          _id: "$sharedAttributes.packagingSupplyType",
          items: {
            $push: {
              _id: "$_id",
              ...itemColumns.reduce(
                (acc, col) => ({ ...acc, [col]: `$${col}` }),
                {}
              ), // Dynamically include itemColumns
              name: "$sharedAttributes.name",
              productId: "$sharedAttributes._id",
            },
          },
        },
      },
      {
        $project: {
          key: "$_id", // Rename _id to key
          items: 1, // Keep the items array as is
          _id: 0, // Exclude the original _id field
        },
      },
      {
        $skip: (page - 1) * limit, // Pagination: Skip documents for previous pages
      },
      {
        $limit: limit, // Pagination: Limit the number of documents returned
      },
    ]);

    return allItemsByType;
  }

  async updateVariantStatus(variantKey, variantId, status, userInfo) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const query = variantKey ? { _id: variantKey } : { variantId };

      // Create activity log
      const variantActivity = createActivityLog(
        userInfo,
        `Updated Status to ${status}`,
        status,
        []
      );

      // Update the variant and append activity in one query
      const updatedVariant = await ItemModel.findOneAndUpdate(
        query,
        {
          $set: { status, updatedAt: Date.now() },
          $push: { activity: variantActivity },
        },
        {
          new: true,
          upsert: false,
          session,
        }
      ).lean();

      if (!updatedVariant) {
        throw new Error("Variant not found");
      }

      // Fetch the product with validation
      const product = await ItemSharedAttributesModel.findById(
        updatedVariant.sharedAttributes
      )
        .session(session)
        .lean();

      if (!product) {
        throw new Error(`No product found for variant: ${variantId}`);
      }

      const productActivity = createActivityLog(
        userInfo,
        `Variant ${variantId} updated to ${status} status`,
        product.status,
        []
      );

      // Update product
      const updatedProduct = await ItemSharedAttributesModel.findByIdAndUpdate(
        product._id,
        {
          $push: { activity: productActivity },
          $set: { updatedAt: Date.now() },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      ).lean();

      if (!updatedProduct) {
        throw new Error("Failed to update product with new variant");
      }

      await session.commitTransaction();

      return {
        product: {
          _id: updatedProduct._id,
          activity: productActivity,
          updatedAt: updatedProduct.updatedAt,
          status: updatedProduct.status,
        },
        variant: {
          _id: updatedVariant._id,
          status,
          variantId,
          productId: product._id,
          variantDescription: updatedVariant.variantDescription,
          activity: variantActivity,
          updatedAt: updatedVariant.updatedAt,
        },
      };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();

      console.error(
        `Error updating variant with id: ${variantId ?? variantKey}:`,
        error
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  async duplicateVariant(variantId, userInfo) {
    if (!variantId || !userInfo) {
      throw new Error("Variant ID and user info are required");
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Fetch the original variant with product info
      const originalVariant = await ItemModel.findOne({ variantId })
        .session(session)
        .lean();

      if (!originalVariant) {
        throw new Error(`No variant found with id: ${variantId}`);
      }

      // Fetch the product with validation
      const product = await ItemSharedAttributesModel.findById(
        originalVariant.sharedAttributes
      )
        .populate("variantIds")
        .session(session)
        .lean();

      if (!product) {
        throw new Error(`No product found for variant: ${variantId}`);
      }

      // Generate new variant ID
      const productVariantIds = product.variantIds.map((v) => v.variantId);
      const productVariantDescriptions = product.variantIds.map(
        (v) => v.variantDescription
      );
      const newVariantId = incrementVariantId(
        findLargestNumberString(productVariantIds)
      );

      // Create activities
      const variantActivity = createActivityLog(
        userInfo,
        `Variant duplicated from ${variantId}`,
        "draft",
        []
      );

      const productActivity = createActivityLog(
        userInfo,
        `Variant duplicated from ${variantId}`,
        product.status,
        []
      );

      // Prepare the new variant data with default values
      const newDupVar = {
        ...originalVariant,
        variantDescription: duplicateProductName(
          originalVariant.variantDescription,
          productVariantDescriptions
        ),
        variantId: newVariantId,
        status: ITEM_STATUS.draft,
        activity: [variantActivity],
        storageLocations: [],
        SKU: "",
        totalQuantity: {},
        safetyStockLevel: 0,
        reorderOrderPoint: 0,
        reorderQuantity: 0,
        minimumQuantity: 0,
        maximumQuantity: 0,
        unitTypebarcodeValue: "",
        purchaseUnitsbarcodeValue: "",
        salesUnitsbarcodeValue: "",
        minimumOrderQuantity: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      delete newDupVar._id; // Remove the original _id

      // Create and save new variant
      const duplicatedVariant = new ItemModel(newDupVar);
      const savedDuplicatedVariant = await duplicatedVariant.save({ session });

      // Update product with new variant
      const updatedProduct = await ItemSharedAttributesModel.findByIdAndUpdate(
        product._id,
        {
          $push: {
            variantIds: savedDuplicatedVariant._id,
            activity: productActivity,
          },
          $set: { updatedAt: Date.now() },
        },
        {
          session,
          new: true,
          runValidators: true,
        }
      ).lean();

      if (!updatedProduct) {
        throw new Error("Failed to update product with new variant");
      }

      await session.commitTransaction();

      return {
        product: {
          _id: updatedProduct._id,
          activity: productActivity,
          updatedAt: updatedProduct.updatedAt,
          status: updatedProduct.status,
        },
        variant: {
          ...savedDuplicatedVariant.toObject(),
          productId: updatedProduct._id,
        },
      };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();

      throw error;
    } finally {
      session.endSession();
    }
  }

  async deleteVariant(variantId, userInfo) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find and delete the variant document within the transaction
      const deletedVariant = await ItemModel.findOneAndDelete({
        variantId,
      }).session(session);

      if (!deletedVariant) {
        throw new Error("Variant not found");
      }

      // Remove the variant reference from its parent product
      // First get the product to know its status
      const product = await ItemSharedAttributesModel.findById(
        deletedVariant.sharedAttributes
      ).session(session);

      const activityLog = createActivityLog(
        userInfo,
        `Deleted variant ${variantId}`,
        product.status,
        []
      );

      // Update the product to remove variant and add activity
      const updatedProduct = await ItemSharedAttributesModel.findOneAndUpdate(
        { _id: deletedVariant.sharedAttributes },
        {
          $pull: { variantIds: deletedVariant._id },
          $push: { activity: activityLog },
          $set: { updatedAt: Date.now() },
        },
        {
          session,
          new: true, // Returns the updated document
        }
      );

      await deleteImagesFromS3(deletedVariant.variantImages);

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return {
        product: {
          _id: updatedProduct._id,
          status: updatedProduct.status,
          updatedAt: updatedProduct.updatedAt,
          activity: activityLog,
        },
        variant: {
          variantId,
        },
      };
    } catch (error) {
      // If an error occurred, abort the transaction
      await session.abortTransaction();
      session.endSession();
      console.error(`Error deleting variant with id: ${variantId}:`, error);
      throw error;
    }
  }
  async fetchProductForDownload(ids) {
    // If no ids are provided or the ids array is empty, fetch all products.
    const query = ids && ids.length > 0 ? { _id: { $in: ids } } : {};
    const allProducts = await ItemSharedAttributesModel.find(query)
      .populate([
        {
          path: "variantIds",
          populate: {
            path: "billOfMaterial.variant_id",
            model: "Item",
            select:
              "variantImages variantDescription supplierPartNumber variantId itemType unitType",
            populate: {
              path: "sharedAttributes", // Nested population inside relatedItems
              select: "supplierId supplierName productId", // Specify fields to include (optional)
            },
          },
        },
        {
          path: "relatedItems",
          select:
            "variantImages variantDescription supplierPartNumber variantId itemType",
          populate: {
            path: "sharedAttributes", // Nested population inside relatedItems
            select: "supplierId supplierName productId", // Specify fields to include (optional)
          },
        },
      ])
      .lean();
    return allProducts;
  }

  async performInventoryAdjustment(payload, activity, session) {
    try {
      const { variantId, productId, storageLocations, reason, comment } =
        payload;

      const product = await ItemSharedAttributesModel.findOneAndUpdate(
        { _id: productId },
        {
          $set: { updatedAt: Date.now() },
          $push: { activity },
        },
        { new: true, session }
      );

      if (!product) throw new Error("Product not found");

      const variant = await ItemModel.findOne({ variantId }).session(session);

      if (!variant) throw new Error("Variant not found");

      // Update fields
      variant.storageLocations = storageLocations;
      variant.updatedAt = Date.now();

      const currentTotalQuantity = variant.totalQuantity;
      variant.totalQuantity =
        getTotalQuantityFromStorageLocations(storageLocations);

      // create inventory logs
      const inventoryLogPromises = Object.entries(storageLocations).map(
        async ([warehouseId, locations]) => {
          const newTotalQuantity = locations.reduce(
            (sum, loc) => sum + (loc.itemQuantity || 0),
            0
          );
          const oldTotalQuantity = currentTotalQuantity[warehouseId] || 0;

          const newInventoryLog = new InventoryLog({
            variantId: variant._id,
            warehouseId,
            initialQuantity: oldTotalQuantity,
            finalQuantity: newTotalQuantity,
            transactionType: INVENTORY_TRANSACTION_TYPES.INVENTORY_ADJUSTMENT,
            reason,
            comment,
            inventoryValue: roundToTwoDecimals(
              newTotalQuantity * variant.purchasePrice
            ),
          });

          await newInventoryLog.save({ session });

          variant.inventoryLogs.push(newInventoryLog._id);
        }
      );

      try {
        await Promise.all(inventoryLogPromises);
      } catch (error) {
        throw new Error(
          "Failed to save one or more inventory logs: " + error.message
        );
      }

      // Push activity
      variant.activity.push(activity);

      await updateShopifyItemQuantity(variant);

      // Save the updated variant
      await variant.save({ session });

      // Commit the transaction

      return {
        product: {
          _id: product._id,
          updatedAt: product.updatedAt,
          activity: product.activity,
        },
        variant: {
          _id: variant._id,
          variantId: variant.variantId,
          storageLocations: variant.storageLocations,
          updatedAt: variant.updatedAt,
          activity: variant.activity,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error performing inventory adjustment:", error);
      throw error;
    }
  }

  async getVariantByVariantId(variantId) {
    try {
      const variant = await ItemModel.findOne({ variantId });
      if (!variant) throw new Error("Variant not found");
      return variant;
    } catch (error) {
      console.error("Error fetching variant:", error);
      throw error;
    }
  }

  async performInventoryTransfer(payload, activity, authKey, session) {
    try {
      const {
        variantId,
        productId,
        storageLocations,
        comment,
        fromLocation,
        toLocations,
      } = payload;

      const product = await ItemSharedAttributesModel.findOneAndUpdate(
        { _id: productId },
        {
          $set: { updatedAt: Date.now() },
          $push: { activity },
        },
        { new: true, session }
      );

      if (!product) throw new Error("Product not found");

      const variant = await ItemModel.findOne({ variantId }).session(session);

      if (!variant) throw new Error("Variant not found");

      // Update fields
      variant.storageLocations = storageLocations;
      variant.updatedAt = Date.now();

      // Push activity
      variant.activity.push(activity);

      // Save the updated variant
      await variant.save({ session });

      // Uncomment to create tasks for the transfer

      // const res = await createInventoryTransferTasks(authKey, {
      //   variantId,
      //   warehouseId: fromLocation.warehouseId,
      //   pickingLocation: fromLocation?.location_Id,
      //   droppingLocations: toLocations,
      //   comment,
      // });

      // if (res.status !== 1) throw new Error(res.responseMessage);

      // Commit the transaction

      return {
        product: {
          _id: product._id,
          updatedAt: product.updatedAt,
          activity: product.activity,
        },
        variant: {
          _id: variant._id,
          variantId: variant.variantId,
          storageLocations: variant.storageLocations,
          updatedAt: variant.updatedAt,
          activity: variant.activity,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error generating inventory transfer:", error);
      throw error;
    }
  }

  async updateItemQuantityDB(payload) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        variantId,
        warehouseId,
        locationId,
        quantity,
        activity,
        transactionType,
        poId,
      } = payload.data;

      //console.log("warehouseId", warehouseId, "locationId", locationId, quantity, poId, transactionType);

      // 1) Fetch the document
      const doc = await Item.findOne({ variantId }).session(session).exec();
      if (!doc) throw new Error("Item not found");

      // 2) Update storageLocations (Map of arrays)
      let warehouseArr = doc.storageLocations.get(warehouseId) || [];

      let locationExists = false;

      const updatedWarehouseArr = warehouseArr.map((locObj) => {
        if (locObj.locationId === locationId) {
          locationExists = true;
          return {
            ...locObj.toObject?.(), // handle Mongoose subdocs or plain objects
            itemQuantity: locObj.itemQuantity + quantity,
          };
        }
        return locObj;
      });

      // If location was not found, push a new one
      if (!locationExists) {
        updatedWarehouseArr.push({
          locationId,
          itemQuantity: quantity,
          // You can add other default fields here from your schema
        });
      }

      // Re-set the array to ensure Mongoose detects the change
      doc.storageLocations.set(warehouseId, updatedWarehouseArr);
      doc.markModified("storageLocations");

      // 3) Update totalQuantity
      const oldTotalQuantity = doc.totalQuantity[warehouseId] || 0;
      doc.totalQuantity[warehouseId] =
        (doc.totalQuantity[warehouseId] || 0) + quantity;
      doc.markModified("totalQuantity");
      const totalItemQuantity = doc.totalQuantity[warehouseId];

      // 4) Log the activity
      doc.activity.push(activity);

      const newInventoryLog = new InventoryLog({
        variantId: doc._id,
        warehouseId,
        poId,
        initialQuantity: oldTotalQuantity,
        finalQuantity: totalItemQuantity,
        transactionType,
        inventoryValue: roundToTwoDecimals(
          totalItemQuantity * doc.purchasePrice
        ),
      });

      await newInventoryLog.save({ session });

      doc.inventoryLogs.push(newInventoryLog._id);

      await updateShopifyItemQuantity(doc);

      // 5) Save changes
      await doc.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error in updateItemQuantityDB:", error);
      throw error;
    }
  }

  async reduceItemQuantityDB(payload) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        variantId,
        warehouseId,
        locationId,
        quantity,
        activity,
        soId,
        transactionType,
      } = payload.data;

      //console.log("warehouseId", warehouseId, "locationId", locationId, quantity, soId, transactionType);

      // 1) Query the document
      const doc = await Item.findOne({ variantId }).session(session).exec();
      if (!doc) throw new Error("Item not found");

      // 2) Update storageLocations (Map of arrays)
      const warehouseArr = doc.storageLocations.get(warehouseId) || [];

      // Create a new array with updated itemQuantity
      const updatedWarehouseArr = warehouseArr.map((locObj) => {
        if (locObj.locationId === locationId) {
          return {
            ...locObj.toObject?.(), // Handles Mongoose subdocument or plain object
            itemQuantity: locObj.itemQuantity - quantity,
          };
        }
        return locObj;
      });
      //console.log("updatedWarehouseArr",warehouseId, updatedWarehouseArr);
      // Re-set the updated array in the Map
      doc.storageLocations.set(warehouseId, updatedWarehouseArr);
      doc.markModified("storageLocations");

      // 3) Update totalQuantity
      const oldTotalQuantity = doc.totalQuantity[warehouseId] || 0;
      doc.totalQuantity[warehouseId] =
        (doc.totalQuantity[warehouseId] || 0) - quantity;
      doc.markModified("totalQuantity");
      const totalItemQuantity = doc.totalQuantity[warehouseId];

      // 4) Log activity
      doc.activity.push(activity);

      const newInventoryLog = new InventoryLog({
        variantId: doc._id,
        warehouseId,
        soId,
        initialQuantity: oldTotalQuantity,
        finalQuantity: totalItemQuantity,
        transactionType,
        inventoryValue: roundToTwoDecimals(
          totalItemQuantity * doc.purchasePrice
        ),
      });

      await newInventoryLog.save({ session });

      doc.inventoryLogs.push(newInventoryLog._id);

      await updateShopifyItemQuantity(doc);

      // 5) Save the document
      await doc.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error in reduceItemQuantityDB:", error);
      throw error;
    }
  }

  async getChartData(query, authKey) {
    try {
      const {
        warehouseId,
        startDate: startDateStr,
        endDate: endDateStr,
        comparedTo,
        chart,
      } = query;
      const { chartType, dataSource, aggregation } = chart;

      switch (dataSource) {
        case DataSource.TotalInventoryValue: {
          const data = await getTotalInventoryValueChartData({
            chartType,
            comparedTo,
            warehouseId,
            startDateStr,
            endDateStr,
            aggregation,
            dataSource,
          });
          return data;
        }

        case DataSource.TotalInventoryValuePerCategory: {
          const data = await getTotalInventoryValuePerCategoryChartData({
            chartType,
            warehouseId,
            startDateStr,
            endDateStr,
          });
          return data;
        }

        default:
          break;
      }

      return []; // fallback
    } catch (error) {
      console.error("Error generating chart data:", error);
      throw error;
    }
  }

  // Integration settings repository methods
  async getActiveIntegrations() {
    try {
      const integrationSettingsDoc = await IntegrationSettingsModel.findById(
        INTEGRATION_DOCUMENT_ID
      );

      if (!integrationSettingsDoc)
        throw new Error("Database not seeded. Please contact support");

      const integrations = integrationSettingsDoc.integrations;
      const activeIntegrations = Object.entries(integrations)
        .filter(([, config]) => config?.isActive)
        .map(([key]) => key);

      return activeIntegrations;
    } catch (error) {
      console.error("Error fetching active integrations:", error);
      throw error;
    }
  }

  async getIntegrationByKey(key) {
    try {
      const integrationSettingsDoc = await IntegrationSettingsModel.findById(
        INTEGRATION_DOCUMENT_ID
      );

      if (!integrationSettingsDoc)
        throw new Error("Database not seeded. Please contact support");

      return integrationSettingsDoc.integrations[key];
    } catch (error) {
      console.error("Error fetching integration:", error);
      throw error;
    }
  }

  async updateIntegration(key, data) {
    try {
      const integrationSettingsDoc =
        await IntegrationSettingsModel.findOneAndUpdate(
          {
            _id: INTEGRATION_DOCUMENT_ID,
          },
          {
            $set: {
              [`integrations.${key}`]: {
                ...data,
                updatedAt: Date.now(),
              },
            },
          },
          { new: true }
        );

      if (!integrationSettingsDoc)
        throw new Error("Database not seeded. Please contact support");

      return {
        key,
        updatedAt: Date.now(),
      };
    } catch (error) {
      console.error("Error fetching integration:", error);
      throw error;
    }
  }

  async validateShopifyStore(storeDomain) {
    try {
      return storeDomain;
    } catch (error) {
      console.error("Error validating shopify store domain:", error);
      throw error;
    }
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escapes special regex characters
}
// wrapper function handle try-catch
function tryCatchHandler(fn) {
  return async function (...args) {
    // eslint-disable-next-line no-useless-catch
    try {
      return await fn.apply(this, args);
    } catch (error) {
      //return error
      throw error;
    }
  };
}
function sortActivityArray(dataArray) {
  dataArray.forEach((data) => {
    if (data.activity && Array.isArray(data.activity)) {
      // Ensure the data has a 'status' field
      const dataStatus = data.status;

      if (dataStatus) {
        // Filter the activity array based on matching statuses
        const filteredActivity = data.activity.filter((activityItem) => {
          if (Array.isArray(activityItem.status)) {
            // If status is an array, check if any element includes the dataStatus
            return activityItem.status.some((status) => {
              if (typeof status === "string") {
                // Split the status string by commas and trim whitespace
                const statusArray = status.split(",").map((s) => s.trim());
                return statusArray.includes(dataStatus);
              }
              return false;
            });
          } else if (typeof activityItem.status === "string") {
            // If status is a string, split by commas and check inclusion
            const statusArray = activityItem.status
              .split(",")
              .map((s) => s.trim());
            return statusArray.includes(dataStatus);
          }
          return false;
        });

        // Sort the filtered activity array by 'date' in descending order
        filteredActivity.sort((a, b) => b.date - a.date);
        // Replace the activity array with the filtered and sorted results
        data.activity = filteredActivity[0];
      } else {
        // If data status is undefined or null, clear the activity array
        data.activity = {};
      }
    }
  });
  return dataArray;
}

function findRemovedOldImages(newData, oldData) {
  // Create a Set of all new image URLs for O(1) lookup
  const newImagesSet = new Set(newData);

  // Filter out the old images that are not present in the new images Set
  const removedImages = oldData.filter((image) => !newImagesSet.has(image));

  return removedImages;
}

function getVariantSuffixNumber(variants, productId) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return 1; // Start suffix at 1 if no variants exist
  }

  // Extract numeric suffixes from variantIds
  const suffixNumbers = variants
    .map((variant) => {
      if (variant.variantId.startsWith(productId)) {
        const suffixStr = variant.variantId.slice(productId.length);
        const suffixNumber = parseInt(suffixStr, 10);
        return isNaN(suffixNumber) ? 0 : suffixNumber;
      }
      return 0;
    })
    .filter((number) => number > 0);

  // Determine the maximum suffix number
  const maxSuffix = suffixNumbers.length > 0 ? Math.max(...suffixNumbers) : 0;

  return maxSuffix + 1; // Increment by 1 for the next suffix
}

function apiPayloadFormat(status, type, responseMessage, data) {
  return {
    status, // 1 for success, 0 for error
    type, // success/error/ info / error
    responseMessage, // some description of the response
    data, // data if it is there
  };
}
function duplicateProductName(warehouseName, existingWarehouses) {
  let baseName = warehouseName;
  let suffix = 1;
  //console.log(existingWarehouses)
  // Check if the warehouse name already exists
  while (existingWarehouses.includes(warehouseName)) {
    // If it exists, append the suffix and increase the suffix
    warehouseName = `${baseName} ${suffix}`;
    suffix++;
  }

  // Add the new unique warehouse name to the existing warehouses array
  existingWarehouses.push(warehouseName);

  return warehouseName;
}
function generateNextProductId(counter) {
  // Generate the new productId with prefix and zero-padding
  const paddedNumber = counter.toString().padStart(7, "0");
  const productId = `3DL${paddedNumber}`;
  return productId;
}

function addProductArrayFields(productColumns) {
  return PRODUCT_ARRAY_COLUMNS.reduce((acc, col) => {
    if (productColumns.includes(col)) {
      acc[col] = {
        $reduce: {
          input: `$product.${col}`,
          initialValue: "",
          in: {
            $cond: {
              if: { $eq: [{ $literal: "" }, "$$value"] },
              then: "$$this",
              else: { $concat: ["$$value", ", ", "$$this"] },
            },
          },
        },
      };
    }
    return acc;
  }, {});
}

function convertParentArrayColumnsToString(parentColumns) {
  return PRODUCT_ARRAY_COLUMNS.reduce((acc, col) => {
    if (parentColumns.includes(col)) {
      acc[col] = {
        $reduce: {
          input: `$${col}`,
          initialValue: "",
          in: {
            $cond: {
              if: { $eq: [{ $literal: "" }, "$$value"] },
              then: "$$this",
              else: { $concat: ["$$value", ", ", "$$this"] },
            },
          },
        },
      };
    }
    return acc;
  }, {});
}

function addVariantArrayFields(variantColumns) {
  return VARAINT_ARRAY_COLUMNS.reduce((acc, col) => {
    if (variantColumns.includes(col)) {
      acc[col] = {
        $reduce: {
          input: `$${col}`,
          initialValue: "",
          in: {
            $cond: {
              if: { $eq: [{ $literal: "" }, "$$value"] },
              then: "$$this",
              else: { $concat: ["$$value", ", ", "$$this"] },
            },
          },
        },
      };
    }
    return acc;
  }, {});
}

// A map from the 'itemType' in the payload to the "shared" model
const sharedModelLookup = {
  [ITEM_TYPE.products]: ProductsCommon,
  [ITEM_TYPE.packagingSupplies]: PackagingSuppliesCommon,
  [ITEM_TYPE.assembly]: AssemblyCommon,
  [ITEM_TYPE.kits]: KitCommon,
  [ITEM_TYPE.MRO]: MROCommon,
  [ITEM_TYPE.rawMaterial]: RawMaterialCommon,
  [ITEM_TYPE.nonInventoryItems]: NonInventoryCommon,
  [ITEM_TYPE.phantomItems]: PhantomCommon,
};

// A map from the 'itemType' in the payload to the "variant" model
const variantModelLookup = {
  [ITEM_TYPE.products]: Products,
  [ITEM_TYPE.packagingSupplies]: PackagingSupplies,
  [ITEM_TYPE.assembly]: Assembly,
  [ITEM_TYPE.kits]: Kit,
  [ITEM_TYPE.MRO]: MRO,
  [ITEM_TYPE.rawMaterial]: RawMaterial,
  [ITEM_TYPE.nonInventoryItems]: NonInventory,
  [ITEM_TYPE.phantomItems]: Phantom,
};

// helpers.js or a separate file

/**
 * removeItems - deletes multiple Item documents by their `variantId` field.
 */
async function removeItems(variantIds, session) {
  if (!Array.isArray(variantIds) || variantIds.length === 0) return;

  // Find all items to be deleted and get their images
  const itemsToDelete = await ItemModel.find(
    { variantId: { $in: variantIds } },
    { variantImages: 1 }
  ).session(session);

  // Collect all images that need to be deleted
  const imagesToDelete = itemsToDelete.reduce((acc, item) => {
    acc.push(...item.variantImages);

    return acc;
  }, []);

  // Delete images from S3 if there are any
  await deleteImagesFromS3(imagesToDelete);

  // Delete the items
  await ItemModel.deleteMany({ variantId: { $in: variantIds } }).session(
    session
  );
}

/**
 * updateOldItems - updates existing Item documents based on `variantId`.
 */
async function updateOldItems(changedItems, userInfo, session) {
  const updatedDocs = [];

  for (const itemPayload of changedItems) {
    const { variantId, ...updates } = itemPayload;
    const itemDoc = await ItemModel.findOne({ variantId }).session(session);
    if (itemDoc) {
      // Merge new fields
      Object.assign(itemDoc, updates);

      // If images changed, handle them (similar to your old code)
      if (updates.variantImages) {
        const imagesToRemove = findRemovedOldImages(
          updates.variantImages,
          itemDoc.variantImages
        );
        await deleteImagesFromS3(imagesToRemove);
        itemDoc.variantImages = updates.variantImages;
      }

      itemDoc.updatedAt = Date.now();
      // Add an update activity
      itemDoc.activity.push(
        createActivityLog(userInfo, "Item Updated", ["active", "updated"], [])
      );

      // Save changes
      await itemDoc.save({ session });
      updatedDocs.push(itemDoc);
    }
  }

  return updatedDocs;
}

/**
 * createNewItems - adds new `Item` documents for a given ItemShared parent.
 * Similar to your old createNewVariants but adapted to the new schema.
 */
async function createNewItems(
  newItemPayloads,
  productId,
  itemSharedId,
  suffixStart,
  userInfo,
  session
) {
  const newDocs = [];
  let suffix = suffixStart;

  for (const itemPayload of newItemPayloads) {
    // Generate the variantId
    const variantId = `${productId}${suffix}`;

    // Create activity
    const activity = [
      createActivityLog(userInfo, "Item Created", ["active"], []),
    ];

    // Construct the new Item
    const newItem = new ItemModel({
      ...itemPayload,
      productId, // from parent
      variantId,
      productHasVariants: true,
      sharedAttributes: itemSharedId, // link back to the parent
      activity,
    });

    // Save it
    await newItem.save({ session });
    newDocs.push(newItem);
    suffix++;
  }

  return newDocs;
}

module.exports = InventoryRepository;
