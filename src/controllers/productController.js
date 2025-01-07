const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { Client } = require("@elastic/elasticsearch");
const elasticClient = new Client({ node: process.env.ELASTICSEARCH_HOST });

const { parseQuery } = require("../utils/searchResolve");
const { sendResponse } = require("../utils/responseHandler");

const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);

    const offset = (pageInt - 1) * limitInt;

    const totalProducts = await prisma.product.count();

    const totalPages = Math.ceil(totalProducts / limitInt);

    const allProducts = await prisma.product.findMany({
      skip: offset,
      take: limitInt,
      include: { subCategory: true },
    });

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Success",
      data: {
        products: allProducts,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    console.error(error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      data: {
        error: error.message,
      },
    });
  }
};

const getFlashDealProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { discountPercentage: { gte: 25 } },
      orderBy: { discountPercentage: "desc" },
      take: 5,
    });
    if (!products) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "Flash deal product not found.",
        data: null,
      });
    }
    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Success",
      data: products,
    });
  } catch (error) {
    console.error(error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getFilteredProducts = async (req, res) => {
  try {
    const {
      categoryName,
      subCategoryNames,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 10,
    } = req.query;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);

    const offset = (pageInt - 1) * limitInt;

    let filter = {};

    if (minPrice || maxPrice) {
      filter.offerPrice = {};
      if (minPrice) filter.offerPrice.gte = parseFloat(minPrice);
      if (maxPrice) filter.offerPrice.lte = parseFloat(maxPrice);
    }

    let subCategories = [];

    if (subCategoryNames) {
      subCategories = Array.isArray(subCategoryNames)
        ? subCategoryNames
        : subCategoryNames.split(",");
    } else if (categoryName) {
      const category = await prisma.category.findUnique({
        where: { name: categoryName },
        include: { subCategories: { select: { name: true } } },
      });

      if (category) {
        subCategories = category.subCategories.map(
          (subCategory) => subCategory.name
        );
      }
    }

    if (subCategories.length > 0) {
      filter.subCategory = { name: { in: subCategories } };
    }

    const products = await prisma.product.findMany({
      skip: offset,
      take: limitInt,
      where: filter,
      orderBy: sort
        ? { actualPrice: sort === "low to high" ? "asc" : "desc" }
        : undefined,
      include: { subCategory: true },
    });

    if (!products.length) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "No products found matching the filters.",
      });
    }

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Success",
      data: {
        products,
        length: products.length,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const searchProducts = async (req, res) => {
  try {
    const {
      query,
      brand,
      category,
      subCategory,
      minPrice,
      maxPrice,
      page = 1,
      size = 10,
    } = req.query;

    if (!query) {
      return sendResponse(res, {
        status: 400,
        type: "error",
        message: "Search query is required",
      });
    }

    const parsedQuery = await parseQuery(query);
    console.log("Parsed Query:", parsedQuery);

    const offset = (page - 1) * size;

    // Construct the Elasticsearch query
    const searchBody = {
      from: offset,
      size: parseInt(size),
      query: {
        bool: {
          should: [
            {
              match: {
                name: {
                  query: query,
                  boost: 5,
                  fuzziness: "AUTO",
                },
              },
            },
            ...(parsedQuery.brand
              ? [
                  {
                    match: {
                      brand: {
                        query: parsedQuery.brand,
                        boost: 4,
                        fuzziness: "AUTO",
                      },
                    },
                  },
                ]
              : []),
            ...(parsedQuery.category
              ? [
                  {
                    match: {
                      category: {
                        query: parsedQuery.category,
                        boost: 3,
                        fuzziness: "AUTO",
                      },
                    },
                  },
                ]
              : []),
            ...(parsedQuery.subCategory
              ? [
                  {
                    match: {
                      subCategory: {
                        query: parsedQuery.subCategory,
                        boost: 2,
                        fuzziness: "AUTO",
                      },
                    },
                  },
                ]
              : []),
            {
              query_string: {
                query: `*${query}*`,
                fields: [
                  "name",
                  "brand",
                  "description",
                  "category",
                  "subCategory",
                ],
                boost: 0.5,
              },
            },
          ],
          minimum_should_match: 1,
          filter: [
            ...(parsedQuery.minPrice
              ? [{ range: { offerPrice: { gte: parsedQuery.minPrice } } }]
              : []),
            ...(parsedQuery.maxPrice
              ? [{ range: { offerPrice: { lte: parsedQuery.maxPrice } } }]
              : []),
          ],
        },
      },
    };

    console.log("Elasticsearch Query:", JSON.stringify(searchBody, null, 2));

    const body = await elasticClient.search({
      index: "products",
      body: searchBody,
    });

    const products = body.hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source,
    }));

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Products fetched successfully",
      data: products,
      totalCount: body.hits.total.value || 0,
    });
  } catch (error) {
    console.error("Error fetching products from Elasticsearch:", error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Server error",
    });
  }
};

const getCategory = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        name: true,
        id: true,
        subCategories: {
          select: {
            name: true,
            id: true,
          },
        },
      },
    });

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Success",
      data: categories,
    });
  } catch (error) {
    console.error(error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getSubCategory = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const subCategories = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) },
      select: {
        subCategories: { select: { name: true, id: true } },
      },
    });
    // const subCategoryNames = categories.flatMap(category => category.subCategories.map(subCategory => subCategory.name));

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Success",
      data: subCategories,
    });
  } catch (error) {
    console.error(error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getProdyctById = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId || isNaN(productId)) {
      return sendResponse(res, {
        status: 400,
        type: "error",
        message: "Invalid or missing productId.",
      });
    }
    const product = await prisma.product.findFirst({
      where: { id: parseInt(productId) },
    });

    if (!product) {
      sendResponse(res, {
        status: 404,
        type: "error",
        message: "Product not found.",
      });
    }
    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Product retrieved successfully.",
      data: product,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error!",
    });
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.query;
    if (!subCategoryId || isNaN(subCategoryId)) {
      sendResponse(res, {
        status: 400,
        type: "error",
        message: "Invalid or missing subCategoryId.",
      });
    }
    const Products = await prisma.product.findMany({
      where: { subCategoryId: parseInt(subCategoryId) },
      select: {
        id: true,
        name: true,
        description: true,
        actualPrice: true,
        offerPrice: true,
        discountPercentage: true,
        subCategoryId: true,
        rating: true,
      },
    });
    if (!Products) {
      sendResponse(res, {
        status: 404,
        type: "error",
        message: "No Products Found.",
      });
    }
    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Success",
      data: Products,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error!",
    });
  }
};

module.exports = {
  getAllProducts,
  getFlashDealProducts,
  getFilteredProducts,
  searchProducts,
  getCategory,
  getSubCategory,
  getProdyctById,
  getProductsByCategory,
};
