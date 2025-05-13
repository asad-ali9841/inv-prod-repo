const { getRestClient } = require("./shopify-api-config");

module.exports.updateShopifyProduct = async (productId, productData) => {
  try {
    const client = await getRestClient();

    // Update the product on Shopify
    const response = await client.put({
      path: `products/${productId}`,
      data: { product: productData },
    });

    return response.body.product;
  } catch (error) {
    console.error("Error updating product on Shopify:", error);
    throw error;
  }
};

// Get all products with pagination
module.exports.getShopifyProducts = async (options = {}) => {
  try {
    const client = await getRestClient();

    // Default query parameters
    const queryParams = {
      limit: options.limit || 50,
      ...options.params,
    };

    // If a page_info cursor is provided, use it for pagination
    if (options.pageInfo) {
      queryParams.page_info = options.pageInfo;
    }

    const response = await client.get({
      path: "products",
      query: queryParams,
    });

    // Return both the products and pagination info
    return {
      products: response.body.products,
      pageInfo: {
        nextPage: response.pageInfo?.next,
        prevPage: response.pageInfo?.previous,
      },
      headers: response.headers,
    };
  } catch (error) {
    console.error("Error fetching products from Shopify:", error);
    throw error;
  }
};

// Get a single product by ID
module.exports.getShopifyProductById = async (productId) => {
  try {
    const client = await getRestClient();

    const response = await client.get({
      path: `products/${productId}`,
    });

    console.log(
      "response in getShopifyProductById:",
      response,
      response.body.product
    );

    return response.body.product;
  } catch (error) {
    console.error(`Error fetching product ${productId} from Shopify:`, error);
    throw error;
  }
};

// Search for products
module.exports.searchShopifyProducts = async (query) => {
  try {
    const client = await getRestClient();

    const response = await client.get({
      path: "products",
      query: {
        title: query,
        limit: 50,
      },
    });
    console.log(
      "response for searchShopifyProducts:",
      response,
      response.body.products
    );

    return response.body.products;
  } catch (error) {
    console.error(`Error searching products with query "${query}":`, error);
    throw error;
  }
};

module.exports.getShopifyProductByTitle = async (title) => {
  try {
    const client = await getRestClient();

    const response = await client.get({
      path: "products",
      query: {
        title,
        limit: 1,
      },
    });

    const product =
      response.body.products?.length === 1 ? response.body.products[0] : null;

    console.log("response for searchShopifyProducts:", response, product);

    return product;
  } catch (error) {
    console.error(`Error searching products with title "${title}":`, error);
    throw error;
  }
};

module.exports.updateShopifyInventoryQuantity = async (title, newQuantity) => {
  try {
    // First, get the product to find its inventory item ID
    const client = await getRestClient();

    const productTitleResponse = await client.get({
      path: "products",
      query: {
        title,
        limit: 1,
      },
    });

    const product =
      productTitleResponse.body.products?.length === 1
        ? productTitleResponse.body.products[0]
        : null;

    if (!product) throw new Error("Product not found");

    console.log("product by title", product);

    const variant = product.variants[0]; // Use specific variant if needed
    const inventoryItemId = variant.inventory_item_id;

    // Get inventory levels to find available locations
    const inventoryResponse = await client.get({
      path: `inventory_levels.json`,
      query: { inventory_item_ids: inventoryItemId },
    });

    console.log(
      "inventiry json stuff:",
      inventoryResponse.body.inventory_levels
    );

    let locationId;

    if (inventoryResponse.body.inventory_levels.length > 0) {
      // Use the first location that already has inventory for this item
      locationId = inventoryResponse.body.inventory_levels[0].location_id;
      console.log(`Using existing inventory location: ${locationId}`);
    } else {
      // Fetch all locations and use the first one as default
      const locationsResponse = await client.get({
        path: `locations.json`,
      });

      if (locationsResponse.body.locations.length === 0) {
        throw new Error("No locations found in the store");
      }

      // Use the first active location
      const activeLocations = locationsResponse.body.locations.filter(
        (location) => location.active
      );

      if (activeLocations.length === 0) {
        throw new Error("No active locations found in the store");
      }

      locationId = activeLocations[0].id;
      console.log(
        `No existing inventory found, using default location: ${locationId}`
      );
    }

    // Then update the inventory level for this item at the specified location
    const updateResponse = await client.post({
      path: `inventory_levels/set`,
      data: {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: newQuantity,
      },
    });

    return updateResponse.body.inventory_level;
  } catch (error) {
    console.error("Error updating inventory quantity:", error);
    throw error;
  }
};

module.exports.createShopifyProduct = async (productData) => {
  try {
    const client = await getRestClient();

    // Create the product on Shopify
    const response = await client.post({
      path: "products",
      data: { product: productData },
    });
    console.log("created product:", response.body.product);

    return response.body.product;
  } catch (error) {
    console.error("Error creating product on Shopify:", error);
    throw error;
  }
};
