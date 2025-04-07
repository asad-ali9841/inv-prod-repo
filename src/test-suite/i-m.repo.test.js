const { InventoryRepository } = require("../database");
//const  UserService = require("../services/user-service");
const { databaseConnection, connect_redis } = require("../database/connection");

var couchbase = require("couchbase");

//1. Find latest Products
describe("find Latest ProductId", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection(); // Ensure the mock database is initialized
    inventoryRepository = new InventoryRepository();
    inventoryRepository.cluster = {
      query: jest.fn(),
    };
  });

  beforeEach(() => {});

  it("should return the latest productId when products exist", async () => {
    const mockProductID = "123";
    inventoryRepository.cluster.query.mockResolvedValue({
      rows: [{ productId: mockProductID }],
    });

    const productId = await inventoryRepository.findLatestProductId();

    expect(inventoryRepository.cluster.query).toHaveBeenCalled();
    expect(productId).toBe(mockProductID);
  });

  it("should return null when no products exist", async () => {
    inventoryRepository.cluster.query.mockResolvedValue({ rows: [] });

    const productId = await inventoryRepository.findLatestProductId();

    expect(inventoryRepository.cluster.query).toHaveBeenCalled();
    expect(productId).toBeNull();
  });

  it("should return null and log an error when the query fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const error = new Error("Query failed");
    inventoryRepository.cluster.query.mockRejectedValue(error);

    const productId = await inventoryRepository.findLatestProductId();

    expect(inventoryRepository.cluster.query).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "Error querying Couchbase",
      error
    );
    expect(productId).toBeNull();
    consoleSpy.mockRestore();
  });
  
});

//2. Add Stage 1 data to DB
describe("stage 1 Data To DB", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection(); // Ensure the mock database is initialized
    inventoryRepository = new InventoryRepository();
    inventoryRepository.collection = {
      insert: jest.fn(),
    };
  });

  beforeEach(() => {});

  it("should add the payload with incomplete status to the database", async () => {
    const payload = { productId: "123", otherData: "test" };
    const expectedPayload = { ...payload, status: 'incomplete' };
    inventoryRepository.collection.insert.mockResolvedValue(true);

    const result = await inventoryRepository.stage1DataToDB(payload);

    expect(inventoryRepository.collection.insert).toHaveBeenCalledWith(expectedPayload.productId, expectedPayload);
    expect(result).toBe(true);
  });

  it("should throw an error if the database operation fails", async () => {
    const payload = { productId: "123", otherData: "test" };
    const expectedPayload = { ...payload, status: 'incomplete' };
    const error = new Error("Insert failed");
    inventoryRepository.collection.insert.mockRejectedValue(error);
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    await expect(inventoryRepository.stage1DataToDB(payload)).rejects.toThrow("Insert failed");

    expect(inventoryRepository.collection.insert).toHaveBeenCalledWith(expectedPayload.productId, expectedPayload);
    consoleSpy.mockRestore();
  });
});

//3. Add stage 2 data to DB
describe("stage 2 Data To DB", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection(); // Ensure the mock database is initialized
    inventoryRepository = new InventoryRepository();
    inventoryRepository.collection = {
      mutateIn: jest.fn(),
    };
  });

  beforeEach(() => {});

  it("should upsert supplier information into the database", async () => {
    const productKey = "product123";
    const payload = {
      supplierId: "supplierId",
      supplierP_N: "supplierP_N",
      supplierAlternateP_N: "supplierAlternateP_N",
      preferredSupplier: true,
      replacementPartInfo: "replacementPartInfo",
    };
    const expectedSupplierInfo = {
      supplierId: payload.supplierId,
      supplierP_N: payload.supplierP_N,
      supplierAlternateP_N: payload.supplierAlternateP_N,
      preferredSupplier: payload.preferredSupplier,
      replacementPartInfo: payload.replacementPartInfo,
    };
    inventoryRepository.collection.mutateIn.mockResolvedValue(true);

    const result = await inventoryRepository.stage2DataToDB(productKey, payload);

    expect(inventoryRepository.collection.mutateIn).toHaveBeenCalledWith(productKey, [
      couchbase.MutateInSpec.upsert(`supplierInfo`, expectedSupplierInfo, { createParents: true }),
    ]);
    expect(result).toBe(true);
  });

  it("should return an error if the database mutation fails", async () => {
    const productKey = "productKey123";
    const payload = {
      supplierId: "supplierId",
      supplierP_N: "supplierP_N",
      supplierAlternateP_N: "supplierAlternateP_N",
      preferredSupplier: "preferredSupplier",
      replacementPartInfo: "replacementPartInfo",
    };

    const error = new Error("Mutation failed");
    inventoryRepository.collection.mutateIn.mockRejectedValue(error);

    await expect(inventoryRepository.stage2DataToDB(productKey, payload)).rejects.toThrow("Mutation failed");

    expect(inventoryRepository.collection.mutateIn).toHaveBeenCalledWith(
      productKey,
      [expect.anything()]
    );
  });

});

// 4. Add stage 3 data to DB
describe("stage 3 Data To DB", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.collection = {
      mutateIn: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully update technical details in the database", async () => {
    const productKey = "productKey123";
    const technicalDetails = {
      detail1: "value1",
      detail2: "value2",
    };

    inventoryRepository.collection.mutateIn.mockResolvedValue(true);

    const result = await inventoryRepository.stage3DataToDB(productKey, technicalDetails);
    expect(inventoryRepository.collection.mutateIn).toHaveBeenCalledWith(
      productKey,
      [couchbase.MutateInSpec.upsert(`technicalDetails`, technicalDetails, { createParents: true })]
    );
    expect(result).toBe(true);
  });

  it("should return an error if the database mutation fails", async () => {
    const productKey = "productKey123";
    const technicalDetails = {
      detail1: "value1",
      detail2: "value2",
    };

    const error = new Error("Mutation failed");
    inventoryRepository.collection.mutateIn.mockRejectedValue(error);

    await expect(inventoryRepository.stage3DataToDB(productKey, technicalDetails)).rejects.toThrow("Mutation failed");

    expect(inventoryRepository.collection.mutateIn).toHaveBeenCalledWith(
      productKey,
      [couchbase.MutateInSpec.upsert(`technicalDetails`, technicalDetails, { createParents: true })]
    );
  });
});

// 5. Add Stage 4 Data to Db
describe("stage 4 Data To DB", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.collection = {
      mutateIn: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully update various product details in the database", async () => {
    const productKey = "productKey123";
    const payload = {
      category: "category123",
      relatedItems_Assessories: ["item1", "item2"],
      associatedServices: ["service1", "service2"],
      variants: ["variant1", "variant2"],
      rating: 5,
    };

    inventoryRepository.collection.mutateIn.mockResolvedValue(true);

    const result = await inventoryRepository.stage4DataToDB(productKey, payload);
    expect(inventoryRepository.collection.mutateIn).toHaveBeenCalledWith(
      productKey,
      expect.arrayContaining([
        couchbase.MutateInSpec.upsert(`category`, payload.category, { createParents: true }),
        couchbase.MutateInSpec.upsert(`relatedItems_Assessories`, payload.relatedItems_Assessories, { createParents: true }),
        couchbase.MutateInSpec.upsert(`associatedServices`, payload.associatedServices, { createParents: true }),
        couchbase.MutateInSpec.upsert(`variants`, payload.variants, { createParents: true }),
        couchbase.MutateInSpec.upsert(`rating`, payload.rating, { createParents: true }),
      ])
    );
    expect(result).toBe(true);
  });

  it("should return an error if the database mutation fails", async () => {
    const productKey = "productKey123";
    const payload = {
      category: "category123",
      relatedItems_Assessories: ["item1", "item2"],
      associatedServices: ["service1", "service2"],
      variants: ["variant1", "variant2"],
      rating: 5,
    };

    const error = new Error("Mutation failed");
    inventoryRepository.collection.mutateIn.mockRejectedValue(error);

    await expect(inventoryRepository.stage4DataToDB(productKey, payload)).rejects.toThrow("Mutation failed");

    expect(inventoryRepository.collection.mutateIn).toHaveBeenCalledWith(
      productKey,
      expect.arrayContaining([
        couchbase.MutateInSpec.upsert(`category`, payload.category, { createParents: true }),
        couchbase.MutateInSpec.upsert(`relatedItems_Assessories`, payload.relatedItems_Assessories, { createParents: true }),
        couchbase.MutateInSpec.upsert(`associatedServices`, payload.associatedServices, { createParents: true }),
        couchbase.MutateInSpec.upsert(`variants`, payload.variants, { createParents: true }),
        couchbase.MutateInSpec.upsert(`rating`, payload.rating, { createParents: true }),
      ])
    );
  });
});

// 6. Update Product Status
describe("Update Product Status", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.collection = {
      mutateIn: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully update the product status and append user to activity array", async () => {
    const productKey = "productKey123";
    const status = "active";
    const user = "user123";

    inventoryRepository.collection.mutateIn.mockResolvedValue(true);

    const result = await inventoryRepository.updateProductStatusDB(productKey, status, user);
    expect(inventoryRepository.collection.mutateIn).toHaveBeenCalledWith(
      productKey,
      [
        couchbase.MutateInSpec.upsert(`status`, status, { createParents: true }),
        couchbase.MutateInSpec.arrayAppend(`activity`, user, { createParents: true }),
      ]
    );
    expect(result).toBe(true);
  });

  it("should return an error if the database mutation fails", async () => {
    const productKey = "productKey123";
    const status = "active";
    const user = "user123";

    const error = new Error("Mutation failed");
    inventoryRepository.collection.mutateIn.mockRejectedValue(error);

    await expect(inventoryRepository.updateProductStatusDB(productKey, status, user)).rejects.toThrow("Mutation failed");

    expect(inventoryRepository.collection.mutateIn).toHaveBeenCalledWith(
      productKey,
      [
        couchbase.MutateInSpec.upsert(`status`, status, { createParents: true }),
        couchbase.MutateInSpec.arrayAppend(`activity`, user, { createParents: true }),
      ]
    );
  });
});

// 7.  Get products
describe("fetch Products DB", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.cluster = {
      query: jest.fn(),
    };
  });

  it("should return null when no products are found", async () => {
    const offset = 0;
    const limit = 10;
    inventoryRepository.cluster.query.mockResolvedValue({ rows: [] });

    const result = await inventoryRepository.fetchProductsDB(offset, limit);

    expect(inventoryRepository.cluster.query).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("should return products when they are found", async () => {
    const offset = 0;
    const limit = 10;
    const mockProducts = [{ productId: "123", name: "Product" }];
    inventoryRepository.cluster.query.mockResolvedValue({ rows: mockProducts });

    const result = await inventoryRepository.fetchProductsDB(offset, limit);

    expect(inventoryRepository.cluster.query).toHaveBeenCalled();
    expect(result).toEqual(mockProducts);
  });

  // it("should log an error and return null when the query fails", async () => {
  //   const offset = 0;
  //   const limit = 10;
  //   const error = new Error("Query failed");
  //   inventoryRepository.cluster.query.mockRejectedValue(error);
  //   const consoleSpy = jest.spyOn(console, "error").mockImplementation();

  //   await inventoryRepository.fetchProductsDB(offset, limit).rejects.toThrow("Error querying Couchbase");

  //   expect(inventoryRepository.cluster.query).toHaveBeenCalled();
  //   expect(result).toBeNull();
  //   consoleSpy.mockRestore();
  // });
});

//8. get product by key
describe("fetch Product By Key", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.collection = {
      get: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the product content when the product is found", async () => {
    const key = "productKey123";
    const mockContent = { id: key, name: "Product", price: 100 };
    inventoryRepository.collection.get.mockResolvedValue({ content: mockContent });

    const result = await inventoryRepository.fetchProductByKey(key);

    expect(inventoryRepository.collection.get).toHaveBeenCalledWith(key);
    expect(result).toEqual(mockContent);
  });

  it("should return null when the product is not found", async () => {
    const key = "productKey123";
    inventoryRepository.collection.get.mockResolvedValue({ content: null });

    const result = await inventoryRepository.fetchProductByKey(key);

    expect(inventoryRepository.collection.get).toHaveBeenCalledWith(key);
    expect(result).toBeNull();
  });

  it("should log an error and rethrow it when the get operation fails", async () => {
    const key = "productKey123";
    const error = new Error("Get operation failed");
    inventoryRepository.collection.get.mockRejectedValue(error);
    const consoleSpy = jest.spyOn(console, "log"); // Using console.log as per tryCatchHandler

    const wrappedFunction = tryCatchHandler(inventoryRepository.fetchProductByKey.bind(inventoryRepository));

    await expect(wrappedFunction(key)).rejects.toThrow("Get operation failed");

    expect(inventoryRepository.collection.get).toHaveBeenCalledWith(key);
    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });
});

// 9. Check existence of category
describe("check Category Existence", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.categoryCollection = {
      get: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return exists: true if the category exists", async () => {
    const name = "existingCategory";
    const mockResult = { id: name, type: "category" };
    inventoryRepository.categoryCollection.get.mockResolvedValue(mockResult);

    const result = await inventoryRepository.checkCatExist(name);

    expect(inventoryRepository.categoryCollection.get).toHaveBeenCalledWith(name);
    expect(result).toEqual({ exists: true, result: mockResult });
  });

  it("should return exists: false if the category does not exist", async () => {
    const name = "nonExistingCategory";
    const error = new couchbase.DocumentNotFoundError();
    inventoryRepository.categoryCollection.get.mockRejectedValue(error);

    const result = await inventoryRepository.checkCatExist(name);

    expect(inventoryRepository.categoryCollection.get).toHaveBeenCalledWith(name);
    expect(result).toEqual({ exists: false });
  });

  it("should rethrow the error if a non-DocumentNotFoundError occurs", async () => {
    const name = "categoryWithError";
    const error = new Error("Unexpected error");
    inventoryRepository.categoryCollection.get.mockRejectedValue(error);

    await expect(inventoryRepository.checkCatExist(name)).rejects.toThrow("Unexpected error");

    expect(inventoryRepository.categoryCollection.get).toHaveBeenCalledWith(name);
  });
});

// 10. Add Category
describe("Add Category", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.categoryCollection = {
      upsert: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when the category is successfully added", async () => {
    const data = { name: "newCategory", description: "A new category" };
    inventoryRepository.categoryCollection.upsert.mockResolvedValue(true); // Simulating a successful upsert

    const result = await inventoryRepository.addCategory(data);

    expect(inventoryRepository.categoryCollection.upsert).toHaveBeenCalledWith(data.name, data);
    expect(result).toBe(true);
  });

  it("should return false when the upsert operation fails", async () => {
    const data = { name: "newCategory", description: "A new category" };
    inventoryRepository.categoryCollection.upsert.mockResolvedValue(false); // Simulating a failed upsert

    const result = await inventoryRepository.addCategory(data);

    expect(inventoryRepository.categoryCollection.upsert).toHaveBeenCalledWith(data.name, data);
    expect(result).toBe(false);
  });

  it("should rethrow the error if the upsert operation throws an error", async () => {
    const data = { name: "newCategory", description: "A new category" };
    const error = new Error("Upsert failed");
    inventoryRepository.categoryCollection.upsert.mockRejectedValue(error);

    await expect(inventoryRepository.addCategory(data)).rejects.toThrow("Upsert failed");

    expect(inventoryRepository.categoryCollection.upsert).toHaveBeenCalledWith(data.name, data);
  });
});

//11. Fetch Categories
describe("fetch Categories", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.cluster = {
      query: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a list of categories when they are found", async () => {
    const offset = 0;
    const limit = 10;
    const mockCategories = [
      { name: "Category1", description: "Description1", status: "Active" },
      { name: "Category2", description: "Description2", status: "Inactive" },
    ];
    inventoryRepository.cluster.query.mockResolvedValue({ rows: mockCategories });

    const result = await inventoryRepository.fetchCategories(offset, limit);

    expect(inventoryRepository.cluster.query).toHaveBeenCalledWith(expect.any(String), {
      scopeName: 'default',
      collectionName: inventoryRepository.categoryCollection,
    });
    expect(result).toEqual(mockCategories);
  });

  it("should return null when no categories are found", async () => {
    const offset = 0;
    const limit = 10;
    inventoryRepository.cluster.query.mockResolvedValue({ rows: [] });

    const result = await inventoryRepository.fetchCategories(offset, limit);

    expect(inventoryRepository.cluster.query).toHaveBeenCalledWith(expect.any(String), {
      scopeName: 'default',
      collectionName: inventoryRepository.categoryCollection,
    });
    expect(result).toBeNull();
  });

  it("should rethrow an error if the query operation fails", async () => {
    const offset = 0;
    const limit = 10;
    const error = new Error("Query failed");
    inventoryRepository.cluster.query.mockRejectedValue(error);

    await expect(inventoryRepository.fetchCategories(offset, limit)).rejects.toThrow("Query failed");

    expect(inventoryRepository.cluster.query).toHaveBeenCalledWith(expect.any(String), {
      scopeName: 'default',
      collectionName: inventoryRepository.categoryCollection,
    });
  });
});

//12. Update Category
describe("Updated Category Data", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.categoryCollection = {
      remove: jest.fn(),
      insert: jest.fn(),
      upsert: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should remove the original entry and insert a new one if name is changing", async () => {
    const nameIsChanging = true;
    const originalName = "oldCategory";
    const updatePayload = { name: "newCategory", description: "Updated description" };

    inventoryRepository.categoryCollection.remove.mockResolvedValue(true);
    inventoryRepository.categoryCollection.insert.mockResolvedValue(true);

    const result = await inventoryRepository.putUpdatedDataToDB(nameIsChanging, originalName, updatePayload);

    expect(inventoryRepository.categoryCollection.remove).toHaveBeenCalledWith(originalName);
    expect(inventoryRepository.categoryCollection.insert).toHaveBeenCalledWith(updatePayload.name, updatePayload);
    expect(result).toBe(true);
  });

  it("should upsert the data if the name is not changing", async () => {
    const nameIsChanging = false;
    const originalName = "existingCategory";
    const updatePayload = { name: "existingCategory", description: "Updated description" };

    inventoryRepository.categoryCollection.upsert.mockResolvedValue(true);

    const result = await inventoryRepository.putUpdatedDataToDB(nameIsChanging, originalName, updatePayload);

    expect(inventoryRepository.categoryCollection.upsert).toHaveBeenCalledWith(originalName, updatePayload);
    expect(result).toBe(true);
  });

  it("should log an error and rethrow it when the remove operation fails during name change", async () => {
    const originalName = "OldCategory";
    const updatePayload = { name: "NewCategory", description: "A new description" };
    const error = new Error("Removal failed");
    inventoryRepository.categoryCollection.remove.mockRejectedValue(error);
    
    // Wrapping with tryCatchHandler
    const wrappedFunction = tryCatchHandler(inventoryRepository.putUpdatedDataToDB.bind(inventoryRepository));
    
    const consoleSpy = jest.spyOn(console, "log"); // Assuming tryCatchHandler logs the error
  
    await expect(wrappedFunction(true, originalName, updatePayload)).rejects.toThrow("Removal failed");
  
    expect(inventoryRepository.categoryCollection.remove).toHaveBeenCalledWith(originalName);
    // Check if the error is logged
    expect(consoleSpy).toHaveBeenCalledWith(error);
    
    consoleSpy.mockRestore();
  });
  
});

//13. Update Category status
describe("update Category Status", () => {
  let inventoryRepository;

  beforeAll(async () => {
    await databaseConnection();
    inventoryRepository = new InventoryRepository();
    inventoryRepository.categoryCollection = {
      mutateIn: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should log an error and rethrow it when the mutateIn operation fails", async () => {
    const key = "categoryKey123";
    const status = "active";
    const logActivity = { user: "user123", action: "updated status" };
    const error = new Error("MutateIn operation failed");
    inventoryRepository.categoryCollection.mutateIn.mockRejectedValue(error);
    const consoleSpy = jest.spyOn(console, "log"); // Assuming error logging with console.log

    const wrappedFunction = tryCatchHandler(inventoryRepository.updateStatusToDB.bind(inventoryRepository));

    await expect(wrappedFunction(key, status, logActivity)).rejects.toThrow("MutateIn operation failed");

    expect(inventoryRepository.categoryCollection.mutateIn).toHaveBeenCalledWith(key, [
      couchbase.MutateInSpec.upsert(`status`, status, { createParents: true }),
      couchbase.MutateInSpec.arrayAppend(`activity`, logActivity, { createParents: true }),
    ]);
    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });
});


// TODO Import thid function later
function tryCatchHandler(fn) {
  return async function (...args) {
      try {
          return await fn.apply(this, args);
      } catch (error) {
          console.log(error)
          throw error;
      }
  };
}