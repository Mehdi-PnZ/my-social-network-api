import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Validator from "better-validator";
import UserModel from "../models/users.mjs";

const check = Validator.expressMiddleware();

const checkRegister = (body) => {
  body("firstName").required().isString().notEmpty();
  body("lastName").required().isString().notEmpty();
  body("email").required().isString().notEmpty();
  body("password").required().isString().notEmpty();
  body("avatar").isString();
  body().strict();
};

const checkLogin = (body) => {
  body("email").required().isString().notEmpty();
  body("password").required().isString().notEmpty();
  body().strict();
};

const Auth = class Auth {
  constructor(app) {
    this.app = app;
    this.run();
  }

  register() {
    this.app.post(
      "/auth/register",
      check.body(checkRegister),
      async (req, res) => {
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
      },
    );
  }

  login() {
    this.app.post("/auth/login", check.body(checkLogin), async (req, res) => {
      try {
        const user = await UserModel.findOne({
          email: req.body.email.toLowerCase(),
        });
        if (!user) {
          return res.status(401).json({
            code: 401,
            message: "Invalid credentials",
          });
        }

        const isValid = await bcrypt.compare(req.body.password, user.password);
        if (!isValid) {
          return res.status(401).json({
            code: 401,
            message: "Invalid credentials",
          });
        }

        const token = jwt.sign(
          { id: user.id, email: user.email },
          process.env.JWT_SECRET || "EFREI",
          { expiresIn: "24h" },
        );

        return res.status(200).json({
          token,
          user,
        });
      } catch (err) {
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error",
        });
      }
    });
  }

  run() {
    this.register();
    this.login();
  }
};

export default Auth;
