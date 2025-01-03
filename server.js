require('dotenv').config(); 

const express = require('express');
const productRoute = require('./src/routes/productRoute');
const cors = require('cors');

const app = express();

const corsOptions = {
    origin: '*', // Allow all origins (for development). Replace '*' with specific origins for production.
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
  };

app.use(express.json());

app.use(cors(corsOptions));

app.get('/', (req,res) => {
    res.send("hello app....!")
})

app.use('/products',productRoute)

app.listen(5000, () => {
    console.log("backend running successfully....");
    
})