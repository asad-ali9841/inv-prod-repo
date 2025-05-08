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
    console.log("response for searchShopifyProducts:", response);

    return response.body.products;
  } catch (error) {
    console.error(`Error searching products with query "${query}":`, error);
    throw error;
  }
};
