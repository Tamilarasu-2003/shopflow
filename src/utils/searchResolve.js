const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const parseQuery = async (query) => {
  try {
    const result = {
      brand: null,
      category: null,
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
    const brandRegex = new RegExp(`\\b(${brandNames})\\b`, "i");

    const brandMatch = query.match(brandRegex);
    if (brandMatch) result.brand = brandMatch[0].trim();

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
    const categoryRegex = new RegExp(
      `\\b(${allCategories.join("|")})\\b`,
      "gi"
    );
    const categoryMatch = query.match(categoryRegex);
    if (categoryMatch) {
      result.category = categoryMatch[0];
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
    if (attributeMatches)
      result.attributes = attributeMatches.map((attr) => attr.toLowerCase());

    return result;
  } catch (error) {
    console.error(error);
  }
};

module.exports = { parseQuery };
