import Validator from "better-validator";
import authToken from "../helper/auth-token.mjs";
import ThreadModel from "../models/threads.mjs";
import GroupModel from "../models/groups.mjs";
import EventModel from "../models/events.mjs";

const check = Validator.expressMiddleware();

const checkCreate = (body) => {
  body("title").required().isString().notEmpty();
  body("group").isString();
  body("event").isString();
  body().strict();
};

const checkUpdate = (body) => {
  body("title").required().isString().notEmpty();
  body().strict();
};

const checkContent = (body) => {
  body("content").required().isString().notEmpty();
  body().strict();
};

const Threads = class Threads {
  constructor(app) {
    this.app = app;
    this.run();
  }

  // Create (avec contrainte stricte : 1 groupe OU 1 événement, mais pas les deux)
  create() {
    this.app.post(
      "/threads",
      authToken,
      check.body(checkCreate),
      async (req, res) => {
        try {
          const { title, group, event } = req.body;

          if ((group && event) || (!group && !event)) {
            return res.status(400).json({
              code: 400,
              message:
                "A thread must be linked to either 1 group OR 1 event, not both.",
            });
          }

          if (group) {
            const foundGroup = await GroupModel.findById(group);
            if (!foundGroup)
              return res
                .status(404)
                .json({ code: 404, message: "Group not found" });

            const isAllowed =
              foundGroup.admins.some((id) => id.toString() === req.user.id) ||
              foundGroup.members.some((id) => id.toString() === req.user.id);
            if (!isAllowed)
              return res
                .status(403)
                .json({ code: 403, message: "Not a group member" });
          }

          if (event) {
            const foundEvent = await EventModel.findById(event);
            if (!foundEvent)
              return res
                .status(404)
                .json({ code: 404, message: "Event not found" });

            const isAllowed =
              foundEvent.organizers.some(
                (id) => id.toString() === req.user.id,
              ) ||
              foundEvent.participants.some(
                (id) => id.toString() === req.user.id,
              );
            if (!isAllowed)
              return res
                .status(403)
                .json({ code: 403, message: "Not an event participant" });
          }

          const thread = new ThreadModel({
            title,
            group: group || null,
            event: event || null,
          });

          await thread.save();
          return res.status(201).json(thread);
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
    this.app.get("/threads/:id", authToken, async (req, res) => {
      try {
        const thread = await ThreadModel.findById(req.params.id)
          .populate("messages.author", "firstName lastName")
          .populate("messages.comments.author", "firstName lastName");

        if (!thread) {
          return res
            .status(404)
            .json({ code: 404, message: "Thread not found" });
        }
        return res.status(200).json(thread);
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
      "/threads/:id",
      authToken,
      check.body(checkUpdate),
      async (req, res) => {
        try {
          const thread = await ThreadModel.findByIdAndUpdate(
            req.params.id,
            { title: req.body.title },
            { new: true },
          );
          if (!thread) {
            return res
              .status(404)
              .json({ code: 404, message: "Thread not found" });
          }
          return res.status(200).json(thread);
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
    this.app.delete("/threads/:id", authToken, async (req, res) => {
      try {
        const thread = await ThreadModel.findByIdAndDelete(req.params.id);
        if (!thread) {
          return res
            .status(404)
            .json({ code: 404, message: "Thread not found" });
        }
        return res.status(200).json(thread);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Search
  search() {
    this.app.get("/threads", authToken, async (req, res) => {
      try {
        const filter = {};
        if (req.query.title)
          filter.title = { $regex: req.query.title, $options: "i" };
        if (req.query.group) filter.group = req.query.group;
        if (req.query.event) filter.event = req.query.event;

        const threads = await ThreadModel.find(filter);
        return res.status(200).json(threads);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Ajouter un message dans le fil
  addMessage() {
    this.app.post(
      "/threads/:id/messages",
      authToken,
      check.body(checkContent),
      async (req, res) => {
        try {
          const thread = await ThreadModel.findById(req.params.id);
          if (!thread)
            return res
              .status(404)
              .json({ code: 404, message: "Thread not found" });

          if (thread.group) {
            const group = await GroupModel.findById(thread.group);
            const isAdmin = group.admins.some(
              (id) => id.toString() === req.user.id,
            );
            const isMember = group.members.some(
              (id) => id.toString() === req.user.id,
            );

            if (!isAdmin && !(isMember && group.allowMemberPosts)) {
              return res.status(403).json({
                code: 403,
                message: "Members are not allowed to post in this group",
              });
            }
          }

          if (thread.event) {
            const event = await EventModel.findById(thread.event);
            const isAllowed =
              event.organizers.some((id) => id.toString() === req.user.id) ||
              event.participants.some((id) => id.toString() === req.user.id);
            if (!isAllowed) {
              return res.status(403).json({
                code: 403,
                message:
                  "Only event organizers or participants can post messages",
              });
            }
          }

          thread.messages.push({
            author: req.user.id,
            content: req.body.content,
          });
          await thread.save();
          return res.status(201).json(thread);
        } catch (err) {
          return res
            .status(500)
            .json({ code: 500, message: "Internal Server Error" });
        }
      },
    );
  }

  // Commenter un message du fil
  addComment() {
    this.app.post(
      "/threads/:id/messages/:messageId/comments",
      authToken,
      check.body(checkContent),
      async (req, res) => {
        try {
          const thread = await ThreadModel.findById(req.params.id);
          if (!thread)
            return res
              .status(404)
              .json({ code: 404, message: "Thread not found" });

          const message = thread.messages.id(req.params.messageId);
          if (!message)
            return res
              .status(404)
              .json({ code: 404, message: "Message not found" });

          message.comments.push({
            author: req.user.id,
            content: req.body.content,
          });
          await thread.save();
          return res.status(201).json(thread);
        } catch (err) {
          return res
            .status(500)
            .json({ code: 500, message: "Internal Server Error" });
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
    this.addMessage();
    this.addComment();
  }
};

export default Threads;
