import Validator from "better-validator";
import authToken from "../helper/auth-token.mjs";
import PollModel from "../models/polls.mjs";
import EventModel from "../models/events.mjs";

const check = Validator.expressMiddleware();

const checkCreate = (body) => {
  body("title").required().isString().notEmpty();
  body("event").required().isString().notEmpty();
  body("questions")
    .required()
    .isArray((q) => {
      q.isObject((item) => {
        item("questionText").required().isString().notEmpty();
        item("options")
          .required()
          .isArray((opt) => opt.isString().notEmpty());
        item().strict();
      });
    });
  body().strict();
};

const checkUpdate = (body) => {
  body("title").isString().notEmpty();
  body("questions").isArray((q) => {
    q.isObject((item) => {
      item("questionText").required().isString().notEmpty();
      item("options")
        .required()
        .isArray((opt) => opt.isString().notEmpty());
      item().strict();
    });
  });
  body().strict();
};

const checkVote = (body) => {
  body("answers")
    .required()
    .isArray((ans) => {
      ans.isObject((item) => {
        item("questionId").required().isString().notEmpty();
        item("optionIndex").required().isNumber();
        item().strict();
      });
    });
  body().strict();
};

const Polls = class Polls {
  constructor(app) {
    this.app = app;
    this.run();
  }

  // Create (réservé aux organisateurs de l'événement)
  create() {
    this.app.post(
      "/polls",
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

          const isOrganizer = event.organizers.some(
            (id) => id.toString() === req.user.id,
          );
          if (!isOrganizer) {
            return res.status(403).json({
              code: 403,
              message: "Only event organizers can create a poll",
            });
          }

          const poll = new PollModel({
            title: req.body.title,
            event: req.body.event,
            questions: req.body.questions,
          });

          await poll.save();
          return res.status(201).json(poll);
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
    this.app.get("/polls/:id", authToken, async (req, res) => {
      try {
        const poll = await PollModel.findById(req.params.id);
        if (!poll) {
          return res.status(404).json({ code: 404, message: "Poll not found" });
        }
        return res.status(200).json(poll);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Update (réservé aux organisateurs de l'événement)
  update() {
    this.app.put(
      "/polls/:id",
      authToken,
      check.body(checkUpdate),
      async (req, res) => {
        try {
          const poll = await PollModel.findById(req.params.id);
          if (!poll) {
            return res
              .status(404)
              .json({ code: 404, message: "Poll not found" });
          }

          const event = await EventModel.findById(poll.event);
          const isOrganizer = event?.organizers.some(
            (id) => id.toString() === req.user.id,
          );
          if (!isOrganizer) {
            return res.status(403).json({
              code: 403,
              message: "Only event organizers can update this poll",
            });
          }

          Object.assign(poll, req.body);
          await poll.save();
          return res.status(200).json(poll);
        } catch (err) {
          return res
            .status(500)
            .json({ code: 500, message: "Internal Server Error" });
        }
      },
    );
  }

  // Delete (réservé aux organisateurs de l'événement)
  delete() {
    this.app.delete("/polls/:id", authToken, async (req, res) => {
      try {
        const poll = await PollModel.findById(req.params.id);
        if (!poll) {
          return res.status(404).json({ code: 404, message: "Poll not found" });
        }

        const event = await EventModel.findById(poll.event);
        const isOrganizer = event?.organizers.some(
          (id) => id.toString() === req.user.id,
        );
        if (!isOrganizer) {
          return res.status(403).json({
            code: 403,
            message: "Only event organizers can delete this poll",
          });
        }

        await PollModel.findByIdAndDelete(req.params.id);
        return res.status(200).json(poll);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Search
  search() {
    this.app.get("/polls", authToken, async (req, res) => {
      try {
        const filter = {};
        if (req.query.title)
          filter.title = { $regex: req.query.title, $options: "i" };
        if (req.query.event) filter.event = req.query.event;

        const polls = await PollModel.find(filter);
        return res.status(200).json(polls);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Répondre au sondage (1 choix unique par question, réservé aux participants/organisateurs)
  vote() {
    this.app.post(
      "/polls/:id/vote",
      authToken,
      check.body(checkVote),
      async (req, res) => {
        try {
          const poll = await PollModel.findById(req.params.id);
          if (!poll) {
            return res
              .status(404)
              .json({ code: 404, message: "Poll not found" });
          }

          const event = await EventModel.findById(poll.event);
          const isAllowed =
            event?.organizers.some((id) => id.toString() === req.user.id) ||
            event?.participants.some((id) => id.toString() === req.user.id);

          if (!isAllowed) {
            return res.status(403).json({
              code: 403,
              message: "Only event participants can vote in this poll",
            });
          }

          for (const ans of req.body.answers) {
            const question = poll.questions.id(ans.questionId);
            if (!question) {
              return res.status(404).json({
                code: 404,
                message: `Question ${ans.questionId} not found`,
              });
            }

            if (
              ans.optionIndex < 0 ||
              ans.optionIndex >= question.options.length
            ) {
              return res
                .status(400)
                .json({ code: 400, message: "Invalid optionIndex" });
            }

            // Remplace l'ancien vote de l'utilisateur sur cette question (garantit 1 réponse unique)
            question.votes = question.votes.filter(
              (v) => v.user.toString() !== req.user.id,
            );
            question.votes.push({
              user: req.user.id,
              optionIndex: ans.optionIndex,
            });
          }

          await poll.save();
          return res.status(200).json(poll);
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
    this.vote();
  }
};

export default Polls;
