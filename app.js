const express = require('express');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const morgan = require('morgan');

const app = express();


// middleware 
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// routes - take files 
const authRoutes = require("./routes/authRoute");
const transactionRoutes = require("./routes/transactionRoute");
const securityRoutes = require("./routes/securityRoute");

// map routing 
app.use("/api/auth", authRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/security", securityRoutes);



module.exports = app;