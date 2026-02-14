import express from "express";
import cors from  "cors";

const app = express();

//basic configuration

app.use(express.json({limit : "16 kb"}));
app.use(express.urlencoded({extended : true, limit : "16kb"}));
app.use(express.static("public"));

//cors configuration
app.use(cors({
    origin : process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
    credentials : true,
    methods : ["GET" , "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders : ["Authorization" , "Content-Type"],
    }),
);

// import the routes

import healthCheckRouter from "./routes/healthcheck.routes.js";

app.use("/api/v1/healthcheck" , healthCheckRouter);

app.get("/" , (req,res) => {
    res.send("Welcome to basecampy")
});



export default app;