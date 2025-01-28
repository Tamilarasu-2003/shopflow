const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// const { Client } = require("@elastic/elasticsearch");
// const elasticClient = new Client({ node: "http://localhost:9200" });

const { Client } = require('@opensearch-project/opensearch');
const AWS = require("aws-sdk");

AWS.config.update({
  region: "ap-south-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const client = new Client({
  node: process.env.ELASTICSEARCH_HOST,
  auth: {
    username: "Tamilarasu",
    password: "Tamil@9976",
  },
  awsConfig: new AWS.Config({
    region: "ap-south-1",
    credentials: new AWS.Credentials(
      process.env.AWS_ACCESS_KEY_ID,
      process.env.AWS_SECRET_ACCESS_KEY
    ),
  }),
});

// const { parseQuery } = require("../utils/searchResolve");
const { sendResponse } = require("../utils/responseHandler");

const getCarousel = async (req, res) => {
  try {
    const carousel = await prisma.carousel.findMany();
    if(!carousel){
      sendResponse(res, {
        status: 404,
        type: error,
        message: "carousel not found...",
      });
    }

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "carousel data fetched successfully..",
      data: carousel
    });
  } catch (error) {
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      data: {
        error: error.message,
      },
    });
  }
}

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
      data: allProducts,
      totalPages: totalPages,
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
      where: { discountPercentage: { gte: 50, lte: 72 } },
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
      data: products,
      length: products.length,
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

// const searchProducts = async (req, res) => {
//   try {
//     const {
//       query,
//       page = 1,
//       size = 10,
//     } = req.query;

//     if (!query) {
//       return sendResponse(res, {
//         status: 400,
//         type: "error",
//         message: "Search query is required",
//       });
//     }

//     const parsedQuery = await parseQuery(query);
//     // console.log("Parsed Query:", parsedQuery);

//     const offset = (page - 1) * size;

//     const searchBody = {
//       query: {
//         bool: {
//           should: [
//             {
//               multi_match: {
//                 query: query,
//                 fields: ["brand^5", "name", "description", "category^3", "subCategory^2"],
//                 fuzziness: "AUTO",
//               },
//             },
//             ...(parsedQuery.brand
//               ? [
//                   {
//                     match: {
//                       brand: {
//                         query: parsedQuery.brand,
//                         boost: 4,
//                         fuzziness: "AUTO",
//                       },
//                     },
//                   },
//                 ]
//               : []),
//             ...(parsedQuery.category
//               ? [
//                   {
//                     match: {
//                       category: {
//                         query: parsedQuery.category,
//                         boost: 3,
//                         fuzziness: "AUTO",
//                       },
//                     },
//                   },
//                 ]
//               : []),
//             ...(parsedQuery.attributes.length > 0
//               ? parsedQuery.attributes.map((attr) => ({
//                   match: {
//                     attributes: {
//                       query: attr,
//                       boost: 2,
//                       fuzziness: "AUTO",
//                     },
//                   },
//                 }))
//               : []),
//           ],
//           minimum_should_match: 1,
//           filter: [
//             ...(parsedQuery.minPrice
//               ? [{ range: { offerPrice: { gte: parsedQuery.minPrice } } }]
//               : []),
//             ...(parsedQuery.maxPrice
//               ? [{ range: { offerPrice: { lte: parsedQuery.maxPrice } } }]
//               : []),
//           ],
//         },
//       },
//     };

//     // console.log("Elasticsearch Query:", JSON.stringify(searchBody, null, 2));

//     const body = await elasticClient.search({
//       index: "products",
//       body: searchBody,
//     });

//     const products = body.hits.hits.map((hit) => ({
//       id: hit._id,
//       ...hit._source,
//     }));

//     res.json( {
//       status: "success",
//       type: "success",
//       message: "Products fetched successfully",
//       data: products,
//       totalCount: body.hits.total.value || 0,
//     });
//   } catch (error) {
//     console.error("Error fetching products from Elasticsearch:", error);
//     sendResponse(res, {
//       status: 500,
//       type: "error",
//       message: "Server error",
//     });
//   }
// };

const searchProducts = async (req, res) => {
  const { query, page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;

  if (!query) {
    return res.status(400).json({ message: "Search query is required" });
  }

  let priceFilter = {};

  const underMatch = query.match(/under\s(\d+)/i);
  if (underMatch) {
    priceFilter["offerPrice"] = { lte: parseFloat(underMatch[1]) };
  }

  const aboveMatch = query.match(/above\s(\d+)/i);
  if (aboveMatch) {
    priceFilter["offerPrice"] = priceFilter["offerPrice"] || {};
    priceFilter["offerPrice"]["gte"] = parseFloat(aboveMatch[1]);
  }

  const betweenMatch = query.match(/between\s(\d+)\s(?:and|to)\s(\d+)/i);
  if (betweenMatch) {
    priceFilter["offerPrice"] = {
      gte: parseFloat(betweenMatch[1]),
      lte: parseFloat(betweenMatch[2]),
    };
  }

  const filterClause = Object.keys(priceFilter).length ? { filter: { range: priceFilter } } : {};

  try {
    console.log("Search query:", query);

    const body = await client.search({
      index: "products",
      body: {
        // from: offset,
        // size: limit,
        query: {
          bool: {
            must: [
              {
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
                    {
                      bool: {
                        must_not: {
                          match: {
                            name: query,
                          },
                        },
                        should: [
                          {
                            match: {
                              "category.name": {
                                query: query,
                                boost: 4,
                                fuzziness: "AUTO",
                              },
                            },
                          },
                          {
                            match: {
                              brand: {
                                query: query,
                                boost: 4,
                                fuzziness: "AUTO",
                              },
                            },
                          },
                          {
                            multi_match: {
                              query: query,
                              fields: ["description"],
                              boost: 2,
                              fuzziness: "AUTO",
                            },
                          },
                          {
                            match: {
                              "subCategory.name": {
                                query: query,
                                boost: 1,
                                fuzziness: "AUTO",
                              },
                            },
                          },
                          {
                            query_string: {
                              query: `*${query}*`,
                              fields: [
                                "name",
                                "category.name",
                                "subCategory.name",
                                "brand",
                                "description",
                              ],
                              boost: 0.5,
                            },
                          },
                        ],
                      },
                    },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
            ...(Object.keys(filterClause).length ? filterClause : {}),
          },
        },
      },
    });

    console.log("offset:", offset);
    console.log("limit:", limit);

    console.log(body.body.hits);

    const data = body.body.hits
      ? body.body.hits.hits.map((hit) => ({
          id: hit._id,
          ...hit._source,
        }))
      : [];
    console.log("totalCount", body.body.hits.total.value);
    res.json({
      data,
      totalCount: body.body.hits ? body.body.hits.total.value : 0,
    });
  } catch (error) {
    console.error("Error fetching products from Elasticsearch:", error);
    res.status(500).send("Server error");
  }
};


// const getSimilarProducts = async (product) => {
//   const { category, brand, attributes } = product;

//   const mltQuery = {
//     query: {
//       more_like_this: {
//         fields: ["category", "brand", "attributes"],
//         like: [
//           {
//             _id: product.id, // We are looking for similar products based on the current product
//           },
//         ],
//         min_term_freq: 1,
//         max_query_terms: 12,
//       },
//     },
//     size: 5, // Adjust this to return more or fewer similar products
//   };

//   const mltResponse = await client.search({
//     index: "products",
//     body: mltQuery,
//   });

//   return mltResponse.body.hits.hits.map((hit) => ({
//     id: hit._id,
//     ...hit._source,
//   }));
// };

const getCategory = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        name: true,
        id: true,
        image: true,
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

const getProductsBySubCategory = async (req, res) => {
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
        image: true,
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

const getTrendingProducts = async (req, res) => {
  try {
    const trendingProducts = await prisma.product.findMany({
      where: {
        rating: { gte: 4.5 },
        stock: { gt: 0 },
      },
      orderBy: [{ rating: "desc" }, { discountPercentage: "desc" }],
      take: 10,
    });

    if (!trendingProducts || trendingProducts.length === 0) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "Trending products not found.",
        data: null,
      });
    }

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Trending products retrieved successfully.",
      data: trendingProducts,
    });
  } catch (error) {
    console.error("Error fetching trending products:", error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getNewArrivals = async (req, res) => {
  try {
    const newArrivals = await prisma.product.findMany({
      where: {
        stock: { gt: 0 },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    if (!newArrivals || newArrivals.length === 0) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "New arrivals not found.",
        data: null,
      });
    }

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "New arrivals retrieved successfully.",
      data: newArrivals,
    });
  } catch (error) {
    console.error("Error fetching new arrivals:", error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getLimitedTimeOffers = async (req, res) => {
  try {
    const now = new Date();
    const limitedOffers = await prisma.product.findMany({
      where: {
        stock: { gt: 0 },
        discountPercentage: { gte: 20, lte: 49 },
        // offerStart: { lte: now },
        // offerEnd: { gte: now },
      },
      orderBy: { discountPercentage: "desc" },
      take: 10,
    });

    if (!limitedOffers || limitedOffers.length === 0) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "No limited time offers found.",
        data: null,
      });
    }

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Limited time offers retrieved successfully.",
      data: limitedOffers,
    });
  } catch (error) {
    console.error("Error fetching limited time offers:", error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getTopRatedProducts = async (req, res) => {
  try {
    const topRatedProducts = await prisma.product.findMany({
      where: {
        stock: { gt: 0 },
        rating: { gte: 4.0 },
      },
      orderBy: { rating: "desc" },
      take: 10,
    });

    if (!topRatedProducts || topRatedProducts.length === 0) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "Top-rated products not found.",
        data: null,
      });
    }

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Top-rated products retrieved successfully.",
      data: topRatedProducts,
    });
  } catch (error) {
    console.error("Error fetching top-rated products:", error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getClearanceSaleProducts = async (req, res) => {
  try {
    const clearanceSaleProducts = await prisma.product.findMany({
      where: {
        discountPercentage: { gte: 50 },
        stock: { lte: 10 },
      },
      orderBy: { discountPercentage: "desc" },
      take: 10,
    });

    if (!clearanceSaleProducts || clearanceSaleProducts.length === 0) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "No clearance sale products found.",
        data: null,
      });
    }

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Clearance sale products retrieved successfully.",
      data: clearanceSaleProducts,
    });
  } catch (error) {
    console.error("Error fetching clearance sale products:", error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
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
  getProductsBySubCategory,
  getTrendingProducts,
  getNewArrivals,
  getLimitedTimeOffers,
  getTopRatedProducts,
  getClearanceSaleProducts,
  getCarousel,
};
