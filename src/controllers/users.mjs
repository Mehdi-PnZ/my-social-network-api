import bcrypt from "bcryptjs";
import Validator from "better-validator";
import authToken from "../helper/auth-token.mjs";
import UserModel from "../models/users.mjs";

const check = Validator.expressMiddleware();

const checkCreate = (body) => {
  body("firstName").required().isString().notEmpty();
  body("lastName").required().isString().notEmpty();
  body("email").required().isString().notEmpty();
  body("password").required().isString().notEmpty();
  body("avatar").isString();
  body().strict();
};

const checkUpdate = (body) => {
  body("firstName").isString().notEmpty();
  body("lastName").isString().notEmpty();
  body("email").isString().notEmpty();
  body("password").isString().notEmpty();
  body("avatar").isString();
  body().strict();
};

const Users = class Users {
  constructor(app) {
    this.app = app;
    this.run();
  }

  // Create
  create() {
    this.app.post("/users", check.body(checkCreate), async (req, res) => {
      try {
        const existingUser = await UserModel.findOne({
          email: req.body.email.toLowerCase(),
        });
        if (existingUser) {
          return res.status(409).json({
            code: 409,
            message: "Email already exists",
          });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new UserModel({
          ...req.body,
          password: hashedPassword,
        });

        await user.save();
        return res.status(201).json(user);
      } catch (err) {
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error",
        });
      }
    });
  }

  // Read
  getById() {
    this.app.get("/users/:id", authToken, async (req, res) => {
      try {
        const user = await UserModel.findById(req.params.id);
        if (!user) {
          return res.status(404).json({
            code: 404,
            message: "User not found",
          });
        }
        return res.status(200).json(user);
      } catch (err) {
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error",
        });
      }
    });
  }

  // Update
  update() {
    this.app.put(
      "/users/:id",
      authToken,
      check.body(checkUpdate),
      async (req, res) => {
        try {
          if (req.body.email) {
            const existingUser = await UserModel.findOne({
              email: req.body.email.toLowerCase(),
              _id: { $ne: req.params.id },
            });
            if (existingUser) {
              return res.status(409).json({
                code: 409,
                message: "Email already exists",
              });
            }
          }

          const updates = { ...req.body };
          if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
          }

          const user = await UserModel.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true },
          );
          if (!user) {
            return res.status(404).json({
              code: 404,
              message: "User not found",
            });
          }

          return res.status(200).json(user);
        } catch (err) {
          return res.status(500).json({
            code: 500,
            message: "Internal Server Error",
          });
        }
      },
    );
  }

  // Delete
  delete() {
    this.app.delete("/users/:id", authToken, async (req, res) => {
      try {
        const user = await UserModel.findByIdAndDelete(req.params.id);
        if (!user) {
          return res.status(404).json({
            code: 404,
            message: "User not found",
          });
        }
        return res.status(200).json(user);
      } catch (err) {
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error",
        });
      }
    });
  }

  // Search
  search() {
    this.app.get("/users", authToken, async (req, res) => {
      try {
        const filter = {};
        if (req.query.firstName)
          filter.firstName = { $regex: req.query.firstName, $options: "i" };
        if (req.query.lastName)
          filter.lastName = { $regex: req.query.lastName, $options: "i" };
        if (req.query.email)
          filter.email = { $regex: req.query.email, $options: "i" };

        const users = await UserModel.find(filter);
        return res.status(200).json(users);
      } catch (err) {
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error",
        });
      }
    });
  }

  run() {
    this.create();
    this.getById();
    this.update();
    this.delete();
    this.search();
  }
};

export default Users;
