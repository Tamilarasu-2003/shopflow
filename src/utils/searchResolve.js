const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const parseQuery = async (query) => {
  try {
    const result = {
      brand: [],
      category: [],
      minPrice: null,
      maxPrice: null,
      attributes: [],
    };

    const brands = await prisma.product.findMany({
      select: {
        brand: true,
      },
    });
    const brandNames = brands.map((brand) => brand.brand).join("|");
    const brandRegex = new RegExp(`\\b(${brandNames})\\b`, "gi");
    const brandMatches = query.match(brandRegex);
    if (brandMatches) {
      result.brand = Array.from(
        new Set(brandMatches.map((brand) => brand.trim()))
      );
    }

    const categories = await prisma.Category.findMany({
      select: {
        name: true,
      },
    });

    const subCategories = await prisma.SubCategory.findMany({
      select: {
        name: true,
      },
    });

    const allCategories = [...categories, ...subCategories];
    const categoryNames = allCategories.map((cat) => cat.name).join("|");
    const categoryRegex = new RegExp(`\\b(${categoryNames})\\b`, "gi");
    const categoryMatches = query.match(categoryRegex);
    if (categoryMatches) {
      result.category = Array.from(
        new Set(categoryMatches.map((cat) => cat.trim()))
      );
    }

    const underMatch = query.match(/under\s(\d+)/i);
    if (underMatch) result.maxPrice = parseFloat(underMatch[1]);

    const aboveMatch = query.match(/above\s(\d+)/i);
    if (aboveMatch) result.minPrice = parseFloat(aboveMatch[1]);

    const betweenMatch = query.match(/between\s(\d+)\s(?:and|to)\s(\d+)/i);
    if (betweenMatch) {
      result.minPrice = parseFloat(betweenMatch[1]);
      result.maxPrice = parseFloat(betweenMatch[2]);
    }

    const attributeMatches = query.match(/\b(black|red|leather)\b/gi);
    if (attributeMatches) {
      result.attributes = Array.from(
        new Set(attributeMatches.map((attr) => attr.toLowerCase()))
      );
    }

    return result;
  } catch (error) {
    console.error(error);
  }
};

module.exports = { parseQuery };
