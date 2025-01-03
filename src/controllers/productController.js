const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllProducts = async (req,res) => {
    try{
        const allProducts = await prisma.product.findMany({
            include:{subCategory: true}
    });
        res.status(200).json({
            message: "Success", 
            data: allProducts})

    }catch (error){
        console.error(error.message);
        res.status(500).json({
            message: "Internal server Error",
            error: error.message
        })

    }
}

const getFlashDealProducts = async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            where : { discountPercentage : { gte : 25 }},
            orderBy : { discountPercentage : 'desc'},
            take : 5,
        })
        if(!products){
            res.status(404).json({message : "flash deal product not found."})
        }
        res.status(200).json({message : "Success", data : products})
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Internal server Error",
            error: error.message
        })
    }
}

const getFilteredProducts = async (req, res) => {
    try {
        const { categoryName, subCategoryNames, minPrice, maxPrice, sort } = req.query;
  
        let filter = {};
  
        if (minPrice || maxPrice) {
            filter.offerPrice = {};
            if (minPrice) filter.offerPrice.gte = parseFloat(minPrice);
            if (maxPrice) filter.offerPrice.lte = parseFloat(maxPrice);
        }
  
        let subCategories = [];
  
        if (subCategoryNames) {
            subCategories = Array.isArray(subCategoryNames) ? subCategoryNames : subCategoryNames.split(',');
        }
        else if (categoryName) {
            const category = await prisma.category.findUnique({
                where: { name: categoryName },
                include: { subCategories: { select: { name: true } } },
            });
  
            if (category) {
                subCategories = category.subCategories.map((subCategory) => subCategory.name);
            }
        }
  
        if (subCategories.length > 0) {
            filter.subCategory = { name: { in: subCategories },};
        }
  
        const products = await prisma.product.findMany({
            where: filter,
            orderBy: sort ? { actualPrice: sort === "low to high" ? "asc" : "desc" } : undefined,
            include: { subCategory: true, },
        });
  
        if (!products.length) {
            return res.status(404).json({ message: "No products found matching the filters.", });
        }
  
        res.status(200).json({ message: "Success", data: products, length: products.length, });

    } catch (error) {
        console.error("Error fetching products:", error.message);
        res.status(500).json({ 
            message: "Internal Server Error", 
            error: error.message,
        });
    }
};

const getCategory = async (req,res) => {
    try {
        const categories = await prisma.category.findMany({
            select : {
                name : true, 
                id : true,
                subCategories : {
                    select : {
                        name : true,
                        id : true,
                    }
                }
            }
        });
        
        res.status(200).json({
            message: "Success", 
            data: categories})

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Internal server Error",
            error: error.message
        });
    }
}

const getSubCategory = async (req, res) => {
    try {
        const { categoryId } = req.query;
        const subCategories = await prisma.category.findUnique({
            where: { id: parseInt(categoryId) },
            select: {
                subCategories: { select: { name: true, id: true} }
            },
        });
        // const subCategoryNames = categories.flatMap(category => category.subCategories.map(subCategory => subCategory.name));
  
        res.status(200).json({
            message: "Success", 
            data: subCategories
        });
  
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const getProdyctById = async (req, res) => {
    try {
        const {productId} = req.query;
        if (!productId || isNaN(productId)) {
            return res.status(400).json({ message: "Invalid or missing productId." });
          }
        const product = await prisma.product.findFirst({
            where : {id: parseInt(productId)},
        });
        console.log(product);
        
        if(!product){
            res.status(404).json({message : "Product not found."});
        }
        res.status(200).json({message : "Success", data: product})
    } catch (error) {
        console.error(error)
        res.status(500).json({message : "Internal Server Error!."})
    }
}

const getProductsByCategory = async (req, res) => {
    try {
        const {subCategoryId} = req.query;
        if(!subCategoryId || isNaN(subCategoryId)){
            return res.status(400).json({ message: "Invalid or missing subCategoryId." });
        }
        const Products = await prisma.product.findMany({
            where : {subCategoryId : parseInt(subCategoryId)},
            select: {
                id: true,
                name: true,
                description: true,
                actualPrice: true,
                offerPrice: true,
                discountPercentage: true,
                subCategoryId : true,
                rating : true,
            },
        })
        if(!Products){
            res.status(404).json({message : "No Products Found."})
        }
        res.status(200).json({message : "success", data : Products});
    } catch (error) {
        console.error(error)
        res.status(500).json({message : "Internal Server Error!."})
    }
}

module.exports = {getAllProducts, getFlashDealProducts, getFilteredProducts, getCategory, getSubCategory, getProdyctById, getProductsByCategory}
  