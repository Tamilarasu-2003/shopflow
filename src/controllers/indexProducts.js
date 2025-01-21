const { Client } = require('@opensearch-project/opensearch');
const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS for OpenSearch
AWS.config.update({
  region: 'ap-south-1', // Your OpenSearch region
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Initialize OpenSearch client with AWS credentials
const client = new Client({
  node: 'https://your-domain-name.ap-south-1.es.amazonaws.com',
  Connection: require('aws-sdk').ElasticsearchService,
  awsConfig: new AWS.Config({
    region: 'ap-south-1',
    credentials: new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY),
  }),
});

// Sample product data (e.g., 250 products)
const allProducts = await prisma.product.findMany({
    include: { subCategory: true },
  });

// Prepare data for bulk indexing
const prepareBulkIndex = (products) => {
  const bulkData = [];
  products.forEach((product) => {
    bulkData.push(
      { index: { _index: 'products', _id: product.id } }, // Action: index product data
      {
        id: product.id,
        name: product.name,
        image: product.image,
        description: product.description,
        stock: product.stock,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        subCategoryId: product.subCategoryId,
        actualPrice: product.actualPrice,
        discountPercentage: product.discountPercentage,
        offerPrice: product.offerPrice,
        rating: product.rating,
        brand: product.brand,
        categoryId: product.categoryId,
        subCategory: product.subCategory,
      }
    );
  });
  return bulkData;
};

// Bulk index function
async function bulkIndexProducts() {
  const bulkData = prepareBulkIndex(products);
  try {
    const response = await client.bulk({
      body: bulkData,
    });
    if (response.body.errors) {
      console.error('Some products failed to index:', response.body.items);
    } else {
      console.log('All products indexed successfully');
    }
  } catch (error) {
    console.error('Error indexing products:', error);
  }
}

// Run the bulk index function
bulkIndexProducts();
