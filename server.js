require("dotenv").config();

const express = require("express");
const productRoute = require("./src/routes/productRoute");
const userRoute = require("./src/routes/userRoute");
const cors = require("cors");

const app = express();

app.use(express.json());

app.use(cors());

app.get("/", (req, res) => {
  res.send("hello....!");
});

app.use("/products", productRoute);
app.use("/user", userRoute);

app.listen(5000, () => {
  console.log("backend running successfully....");
});
