import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

import routes from "./controllers/routes.mjs";

const Server = class Server {
  constructor() {
    this.app = express();
  }

  dbConnect() {
    const host =
      process.env.DB_URI || "mongodb://localhost:27017/my_social_networks";
    mongoose
      .connect(host)
      .then(() => console.log("MongoDB connected"))
      .catch((err) => console.error("MongoDB connection error:", err));
  }

  middleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());
  }

  routes() {
    new routes.Auth(this.app);
    new routes.Users(this.app);
    new routes.Events(this.app);

    this.app.use((req, res) => {
      res.status(404).json({
        code: 404,
        message: "Not Found",
      });
    });
  }

  run() {
    this.dbConnect();
    this.middleware();
    this.routes();
    this.app.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on port ${process.env.PORT || 3000}`);
    });
  }
};

export default Server;
