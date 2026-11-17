import Validator from "better-validator";
import authToken from "../helper/auth-token.mjs";
import GroupModel from "../models/groups.mjs";
import EventModel from "../models/events.mjs";

const check = Validator.expressMiddleware();

const checkCreate = (body) => {
  body("name").required().isString().notEmpty();
  body("description").required().isString().notEmpty();
  body("icon").isString();
  body("coverPhoto").isString();
  body("type").isString().isIn(["public", "private", "secret"]);
  body("allowMemberPosts").isBoolean();
  body("allowMemberEvents").isBoolean();
  body("admins").isArray((item) => item.isString());
  body("members").isArray((item) => item.isString());
  body().strict();
};

const checkUpdate = (body) => {
  body("name").isString().notEmpty();
  body("description").isString().notEmpty();
  body("icon").isString();
  body("coverPhoto").isString();
  body("type").isString().isIn(["public", "private", "secret"]);
  body("allowMemberPosts").isBoolean();
  body("allowMemberEvents").isBoolean();
  body("admins").isArray((item) => item.isString());
  body("members").isArray((item) => item.isString());
  body().strict();
};

const checkCreateGroupEvent = (body) => {
  body("name").required().isString().notEmpty();
  body("description").required().isString().notEmpty();
  body("startDate").required().isString().isISO8601();
  body("endDate").required().isString().isISO8601();
  body("location").required().isString().notEmpty();
  body("coverPhoto").isString();
  body("visibility").isString().isIn(["public", "private"]);
  body().strict();
};

const Groups = class Groups {
  constructor(app) {
    this.app = app;
    this.run();
  }

  // Create
  create() {
    this.app.post(
      "/groups",
      authToken,
      check.body(checkCreate),
      async (req, res) => {
        try {
          const adminsSet = new Set([req.user.id, ...(req.body.admins || [])]);
          const membersSet = new Set([
            ...adminsSet,
            ...(req.body.members || []),
          ]);

          const group = new GroupModel({
            ...req.body,
            admins: Array.from(adminsSet),
            members: Array.from(membersSet),
          });

          await group.save();
          return res.status(201).json(group);
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
    this.app.get("/groups/:id", authToken, async (req, res) => {
      try {
        const group = await GroupModel.findById(req.params.id)
          .populate("admins", "firstName lastName email")
          .populate("members", "firstName lastName email");

        if (!group) {
          return res.status(404).json({
            code: 404,
            message: "Group not found",
          });
        }

        const isMemberOrAdmin =
          group.admins.some((a) => a.id === req.user.id) ||
          group.members.some((m) => m.id === req.user.id);

        if (group.type === "secret" && !isMemberOrAdmin) {
          return res.status(404).json({
            code: 404,
            message: "Group not found",
          });
        }

        if (group.type === "private" && !isMemberOrAdmin) {
          return res.status(403).json({
            code: 403,
            message: "Access denied to private group",
          });
        }

        return res.status(200).json(group);
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
      "/groups/:id",
      authToken,
      check.body(checkUpdate),
      async (req, res) => {
        try {
          const group = await GroupModel.findById(req.params.id);
          if (!group) {
            return res.status(404).json({
              code: 404,
              message: "Group not found",
            });
          }

          const isAdmin = group.admins.some(
            (adminId) => adminId.toString() === req.user.id,
          );
          if (!isAdmin) {
            return res.status(403).json({
              code: 403,
              message: "Only admins can update this group",
            });
          }

          Object.assign(group, req.body);
          await group.save();

          return res.status(200).json(group);
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
    this.app.delete("/groups/:id", authToken, async (req, res) => {
      try {
        const group = await GroupModel.findById(req.params.id);
        if (!group) {
          return res.status(404).json({
            code: 404,
            message: "Group not found",
          });
        }

        const isAdmin = group.admins.some(
          (adminId) => adminId.toString() === req.user.id,
        );
        if (!isAdmin) {
          return res.status(403).json({
            code: 403,
            message: "Only admins can delete this group",
          });
        }

        await GroupModel.findByIdAndDelete(req.params.id);
        return res.status(200).json(group);
      } catch (err) {
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error",
        });
      }
    });
  }

  // Search (les groupes secrets non rejoints sont masqués)
  search() {
    this.app.get("/groups", authToken, async (req, res) => {
      try {
        const filter = {
          $or: [
            { type: { $in: ["public", "private"] } },
            { admins: req.user.id },
            { members: req.user.id },
          ],
        };

        if (req.query.name)
          filter.name = { $regex: req.query.name, $options: "i" };
        if (req.query.type) filter.type = req.query.type;

        const groups = await GroupModel.find(filter);
        return res.status(200).json(groups);
      } catch (err) {
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error",
        });
      }
    });
  }

  // Création d'un événement dans un groupe en invitant automatiquement tous les membres
  createEventInGroup() {
    this.app.post(
      "/groups/:id/events",
      authToken,
      check.body(checkCreateGroupEvent),
      async (req, res) => {
        try {
          const group = await GroupModel.findById(req.params.id);
          if (!group) {
            return res.status(404).json({
              code: 404,
              message: "Group not found",
            });
          }

          const isAdmin = group.admins.some(
            (adminId) => adminId.toString() === req.user.id,
          );
          const isMember = group.members.some(
            (memberId) => memberId.toString() === req.user.id,
          );

          if (!isAdmin && !(isMember && group.allowMemberEvents)) {
            return res.status(403).json({
              code: 403,
              message: "You are not allowed to create events in this group",
            });
          }

          const event = new EventModel({
            ...req.body,
            organizers: [req.user.id],
            participants: group.members,
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

  run() {
    this.create();
    this.getById();
    this.update();
    this.delete();
    this.search();
    this.createEventInGroup();
  }
};

export default Groups;
