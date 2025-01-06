const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { Client } = require("@elastic/elasticsearch");
const elasticClient = new Client({ node: process.env.ELASTICSEARCH_HOST });

const {parseQuery} = require("../utils/searchResolve");

const getAllProducts = async (req, res) => {
  try {
    const allProducts = await prisma.product.findMany({
      include: { subCategory: true },
    });
    

    res.status(200).json({
      message: "Success",
      data: allProducts,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      message: "Internal server Error",
      error: error.message,
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
      res.status(404).json({ message: "flash deal product not found." });
    }
    res.status(200).json({ message: "Success", data: products });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      message: "Internal server Error",
      error: error.message,
    });
  }
};

const getFilteredProducts = async (req, res) => {
  try {
    const { categoryName, subCategoryNames, minPrice, maxPrice, sort } =
      req.query;

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
      where: filter,
      orderBy: sort
        ? { actualPrice: sort === "low to high" ? "asc" : "desc" }
        : undefined,
      include: { subCategory: true },
    });

    if (!products.length) {
      return res
        .status(404)
        .json({ message: "No products found matching the filters." });
    }

    res
      .status(200)
      .json({ message: "Success", data: products, length: products.length });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const searchProducts = async (req, res) => {
    try {
      const {
        query,
        category,
        minPrice,
        maxPrice,
        attributes,
        brand,
        page = 1,
        size = 10,
      } = req.query;
  
      const parsedQuery = await parseQuery(query);
      console.log(parsedQuery);
  
      // Step 1: Search by product name
      let searchQuery = {
        index: 'products',
        body: {
          from: (page - 1) * size,
          size: parseInt(size),
          query: {
            bool: {
              must: [
                {
                  match: {
                    'name': {
                      query: query,
                      boost: 5,
                      fuzziness: 'AUTO',
                    }
                  }
                }
              ],
              filter: [
                ...(parsedQuery.minPrice ? [{ range: { offerPrice: { gte: parsedQuery.minPrice } } }] : []),
                ...(parsedQuery.maxPrice ? [{ range: { offerPrice: { lte: parsedQuery.maxPrice } } }] : []),
              ],
            }
          }
        }
      };
  
      let  body  = await elasticClient.search(searchQuery);
      let products = body.hits.hits;
  
      // If no products are found by name, search by brand and apply price filter
      if (products.length === 0 && brand) {
        searchQuery = {
          index: 'products',
          body: {
            from: (page - 1) * size,
            size: parseInt(size),
            query: {
              bool: {
                should: [
                  {
                    match: {
                      'brand': {
                        query: brand,
                        boost: 4,
                        fuzziness: 'AUTO',
                      }
                    }
                  }
                ],
                filter: [
                  ...(minPrice ? [{ range: { price: { gte: minPrice } } }] : []),
                  ...(maxPrice ? [{ range: { price: { lte: maxPrice } } }] : []),
                ]
              }
            }
          }
        };
  
        // Fetch products by brand
        body = await elasticClient.search(searchQuery);
        products = body.hits.hits;
      }
  
      // Step 2: If products are found, filter by the first product's brand, category, and subcategory
      if (products.length > 0) {
        const firstProduct = products[0]._source;
  
        // Extract the brand, category, and subCategory from the first product
        const foundBrand = firstProduct.brand;
        const foundCategory = firstProduct.category;
        const foundSubCategory = firstProduct.subCategory;
  
        // Step 3: Search using the first product's brand, category, and subcategory
        searchQuery = {
          index: 'products',
          body: {
            from: (page - 1) * size,
            size: parseInt(size),
            query: {
              bool: {
                must: [
                  {
                    match: {
                      'name': {
                        query: query,
                        boost: 5,
                        fuzziness: 'AUTO',
                      }
                    }
                  }
                ],
                filter: [
                  ...(brand ? [{ term: { brand: foundBrand.toLowerCase() } }] : []),
                  ...(category ? [{ term: { category: foundCategory.toLowerCase() } }] : []),
                  ...(subCategory ? [{ term: { subCategory: foundSubCategory.toLowerCase() } }] : []),
                  ...(minPrice ? [{ range: { price: { gte: minPrice } } }] : []),
                  ...(maxPrice ? [{ range: { price: { lte: maxPrice } } }] : []),
                ]
              }
            }
          }
        };
  
        // Perform the final search with refined filters
        body = await elasticClient.search(searchQuery);
        products = body.hits.hits;
      }
  
      // Return the final products and total count
      res.json({
        products: products.map(hit => ({
          id: hit._id,
          ...hit._source,
        })),
        totalCount: body.hits.total.value || 0,
      });
  
    } catch (error) {
      console.error("Error fetching products from Elasticsearch:", error);
      res.status(500).send("Server error");
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

    res.status(200).json({
      message: "Success",
      data: categories,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      message: "Internal server Error",
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

    res.status(200).json({
      message: "Success",
      data: subCategories,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getProdyctById = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId || isNaN(productId)) {
      return res.status(400).json({ message: "Invalid or missing productId." });
    }
    const product = await prisma.product.findFirst({
      where: { id: parseInt(productId) },
    });

    if (!product) {
      res.status(404).json({ message: "Product not found." });
    }
    res.status(200).json({ message: "Success", data: product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error!." });
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.query;
    if (!subCategoryId || isNaN(subCategoryId)) {
      return res
        .status(400)
        .json({ message: "Invalid or missing subCategoryId." });
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
      res.status(404).json({ message: "No Products Found." });
    }
    res.status(200).json({ message: "success", data: Products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error!." });
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
