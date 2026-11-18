import Validator from "better-validator";
import authToken from "../helper/auth-token.mjs";
import EventModel from "../models/events.mjs";

const check = Validator.expressMiddleware();

const checkCreate = (body) => {
  body("name").required().isString().notEmpty();
  body("description").required().isString().notEmpty();
  body("startDate").required().isString().isISO8601();
  body("endDate").required().isString().isISO8601();
  body("location").required().isString().notEmpty();
  body("coverPhoto").isString();
  body("visibility").isString().isIn(["public", "private"]);
  body("organizers").isArray((item) => item.isString());
  body("participants").isArray((item) => item.isString());
  body().strict();
  body("hasShoppingList").isBoolean();
};

const checkUpdate = (body) => {
  body("name").isString().notEmpty();
  body("description").isString().notEmpty();
  body("startDate").isString().isISO8601();
  body("endDate").isString().isISO8601();
  body("location").isString().notEmpty();
  body("coverPhoto").isString();
  body("visibility").isString().isIn(["public", "private"]);
  body("organizers").isArray((item) => item.isString());
  body("participants").isArray((item) => item.isString());
  body().strict();
};

const Events = class Events {
  constructor(app) {
    this.app = app;
    this.run();
  }

  // Create
  create() {
    this.app.post(
      "/events",
      authToken,
      check.body(checkCreate),
      async (req, res) => {
        try {
          const organizersSet = new Set([
            req.user.id,
            ...(req.body.organizers || []),
          ]);
          const event = new EventModel({
            ...req.body,
            organizers: Array.from(organizersSet),
          });

          await event.save();
          return res.status(201).json(event);
        } catch (err) {
          return res.status(500).json({
            code: 500,
            message: "Internal Server Error",
          });
        }
      },
    );
  }

  // Read
  getById() {
    this.app.get("/events/:id", authToken, async (req, res) => {
      try {
        const event = await EventModel.findById(req.params.id)
          .populate("organizers", "firstName lastName email")
          .populate("participants", "firstName lastName email");

        if (!event) {
          return res.status(404).json({
            code: 404,
            message: "Event not found",
          });
        }

        if (event.visibility === "private") {
          const isAllowed =
            event.organizers.some((org) => org.id === req.user.id) ||
            event.participants.some((part) => part.id === req.user.id);

          if (!isAllowed) {
            return res.status(403).json({
              code: 403,
              message: "Access denied to private event",
            });
          }
        }

        return res.status(200).json(event);
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
      "/events/:id",
      authToken,
      check.body(checkUpdate),
      async (req, res) => {
        try {
          const event = await EventModel.findById(req.params.id);
          if (!event) {
            return res.status(404).json({
              code: 404,
              message: "Event not found",
            });
          }

          const isOrganizer = event.organizers.some(
            (orgId) => orgId.toString() === req.user.id,
          );
          if (!isOrganizer) {
            return res.status(403).json({
              code: 403,
              message: "Only organizers can update this event",
            });
          }

          Object.assign(event, req.body);
          await event.save();

          return res.status(200).json(event);
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
    this.app.delete("/events/:id", authToken, async (req, res) => {
      try {
        const event = await EventModel.findById(req.params.id);
        if (!event) {
          return res.status(404).json({
            code: 404,
            message: "Event not found",
          });
        }

        const isOrganizer = event.organizers.some(
          (orgId) => orgId.toString() === req.user.id,
        );
        if (!isOrganizer) {
          return res.status(403).json({
            code: 403,
            message: "Only organizers can delete this event",
          });
        }

        await EventModel.findByIdAndDelete(req.params.id);
        return res.status(200).json(event);
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
    this.app.get("/events", authToken, async (req, res) => {
      try {
        const filter = {
          $or: [
            { visibility: "public" },
            { organizers: req.user.id },
            { participants: req.user.id },
          ],
        };

        if (req.query.name)
          filter.name = { $regex: req.query.name, $options: "i" };
        if (req.query.location)
          filter.location = { $regex: req.query.location, $options: "i" };
        if (req.query.visibility) filter.visibility = req.query.visibility;

        const events = await EventModel.find(filter);
        return res.status(200).json(events);
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

export default Events;
