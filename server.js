require('dotenv').config(); 

const express = require('express');
const session = require("express-session");
const passport = require("./src/middlewares/authMiddleware");
const productRoute = require('./src/routes/productRoute');
const authRoutes = require("./src/routes/authRoute");
const cors = require('cors');

const app = express();

const corsOptions = {
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'], 
  };

app.use(express.json());
app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

app.use(cors(corsOptions));

app.get('/', (req,res) => {
    res.send('<a href="/auth/google">Authenticate with google</a>')
})

app.use('/products',productRoute);
app.use("/auth", authRoutes);


app.listen(5000, () => {
    console.log("backend running successfully....");
    
})