import Validator from "better-validator";
import authToken from "../helper/auth-token.mjs";
import ShoppingItemModel from "../models/shopping.mjs";
import EventModel from "../models/events.mjs";

const check = Validator.expressMiddleware();

const checkCreate = (body) => {
  body("event").required().isString().notEmpty();
  body("name").required().isString().notEmpty();
  body("quantity").required().isNumber();
  body("arrivalTime").required().isString().notEmpty();
  body().strict();
};

const checkUpdate = (body) => {
  body("name").isString().notEmpty();
  body("quantity").isNumber();
  body("arrivalTime").isString().notEmpty();
  body().strict();
};

const isEventMember = (event, userId) =>
  event.organizers.some((id) => id.toString() === userId) ||
  event.participants.some((id) => id.toString() === userId);

const Shopping = class Shopping {
  constructor(app) {
    this.app = app;
    this.run();
  }

  // Create (vérifie activation sur l'événement, rôle participant/organisateur et absence de doublon)
  create() {
    this.app.post(
      "/shopping",
      authToken,
      check.body(checkCreate),
      async (req, res) => {
        try {
          const event = await EventModel.findById(req.body.event);
          if (!event) {
            return res
              .status(404)
              .json({ code: 404, message: "Event not found" });
          }

          if (!event.hasShoppingList) {
            return res.status(400).json({
              code: 400,
              message: "Shopping list is not enabled for this event",
            });
          }

          if (!isEventMember(event, req.user.id)) {
            return res.status(403).json({
              code: 403,
              message: "Only event organizers or participants can add items",
            });
          }

          const duplicate = await ShoppingItemModel.findOne({
            event: req.body.event,
            name: { $regex: `^${req.body.name.trim()}$`, $options: "i" },
          });

          if (duplicate) {
            return res.status(409).json({
              code: 409,
              message:
                "This item is already in the shopping list for this event",
            });
          }

          const item = new ShoppingItemModel({
            event: req.body.event,
            broughtBy: req.user.id,
            name: req.body.name,
            quantity: req.body.quantity,
            arrivalTime: req.body.arrivalTime,
          });

          await item.save();
          return res.status(201).json(item);
        } catch (err) {
          return res
            .status(500)
            .json({ code: 500, message: "Internal Server Error" });
        }
      },
    );
  }

  // Read
  getById() {
    this.app.get("/shopping/:id", authToken, async (req, res) => {
      try {
        const item = await ShoppingItemModel.findById(req.params.id).populate(
          "broughtBy",
          "firstName lastName",
        );

        if (!item) {
          return res
            .status(404)
            .json({ code: 404, message: "Shopping item not found" });
        }
        return res.status(200).json(item);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Update
  update() {
    this.app.put(
      "/shopping/:id",
      authToken,
      check.body(checkUpdate),
      async (req, res) => {
        try {
          const item = await ShoppingItemModel.findById(req.params.id);
          if (!item) {
            return res
              .status(404)
              .json({ code: 404, message: "Shopping item not found" });
          }

          if (req.body.name) {
            const duplicate = await ShoppingItemModel.findOne({
              event: item.event,
              _id: { $ne: item._id },
              name: { $regex: `^${req.body.name.trim()}$`, $options: "i" },
            });
            if (duplicate) {
              return res.status(409).json({
                code: 409,
                message:
                  "This item is already in the shopping list for this event",
              });
            }
          }

          Object.assign(item, req.body);
          await item.save();
          return res.status(200).json(item);
        } catch (err) {
          return res
            .status(500)
            .json({ code: 500, message: "Internal Server Error" });
        }
      },
    );
  }

  // Delete
  delete() {
    this.app.delete("/shopping/:id", authToken, async (req, res) => {
      try {
        const item = await ShoppingItemModel.findByIdAndDelete(req.params.id);
        if (!item) {
          return res
            .status(404)
            .json({ code: 404, message: "Shopping item not found" });
        }
        return res.status(200).json(item);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Search
  search() {
    this.app.get("/shopping", authToken, async (req, res) => {
      try {
        const filter = {};
        if (req.query.name)
          filter.name = { $regex: req.query.name, $options: "i" };
        if (req.query.event) filter.event = req.query.event;

        const items = await ShoppingItemModel.find(filter).populate(
          "broughtBy",
          "firstName lastName",
        );
        return res.status(200).json(items);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
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

export default Shopping;
