import Validator from "better-validator";
import authToken from "../helper/auth-token.mjs";
import TicketTypeModel from "../models/tickets.mjs";
import EventModel from "../models/events.mjs";

const check = Validator.expressMiddleware();

const checkCreate = (body) => {
  body("event").required().isString().notEmpty();
  body("name").required().isString().notEmpty();
  body("price").required().isNumber();
  body("quantity").required().isNumber();
  body().strict();
};

const checkUpdate = (body) => {
  body("name").isString().notEmpty();
  body("price").isNumber();
  body("quantity").isNumber();
  body().strict();
};

const checkBuy = (body) => {
  body("firstName").required().isString().notEmpty();
  body("lastName").required().isString().notEmpty();
  body("email").required().isString().notEmpty();
  body("address").required().isString().notEmpty();
  body().strict();
};

const Tickets = class Tickets {
  constructor(app) {
    this.app = app;
    this.run();
  }

  // Create (uniquement pour un événement public et par un organisateur)
  create() {
    this.app.post(
      "/tickets",
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

          if (event.visibility !== "public") {
            return res.status(400).json({
              code: 400,
              message: "Ticketing is only available for public events",
            });
          }

          const isOrganizer = event.organizers.some(
            (id) => id.toString() === req.user.id,
          );
          if (!isOrganizer) {
            return res.status(403).json({
              code: 403,
              message: "Only event organizers can create ticket types",
            });
          }

          const ticketType = new TicketTypeModel({
            event: req.body.event,
            name: req.body.name,
            price: req.body.price,
            quantity: req.body.quantity,
          });

          await ticketType.save();
          return res.status(201).json(ticketType);
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
    this.app.get("/tickets/:id", authToken, async (req, res) => {
      try {
        const ticketType = await TicketTypeModel.findById(req.params.id);
        if (!ticketType) {
          return res
            .status(404)
            .json({ code: 404, message: "Ticket type not found" });
        }
        return res.status(200).json(ticketType);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Update (réservé aux organisateurs)
  update() {
    this.app.put(
      "/tickets/:id",
      authToken,
      check.body(checkUpdate),
      async (req, res) => {
        try {
          const ticketType = await TicketTypeModel.findById(req.params.id);
          if (!ticketType) {
            return res
              .status(404)
              .json({ code: 404, message: "Ticket type not found" });
          }

          const event = await EventModel.findById(ticketType.event);
          const isOrganizer = event?.organizers.some(
            (id) => id.toString() === req.user.id,
          );
          if (!isOrganizer) {
            return res.status(403).json({
              code: 403,
              message: "Only event organizers can update ticket types",
            });
          }

          if (
            req.body.quantity !== undefined &&
            req.body.quantity < ticketType.tickets.length
          ) {
            return res.status(400).json({
              code: 400,
              message: "Quantity cannot be less than already sold tickets",
            });
          }

          Object.assign(ticketType, req.body);
          await ticketType.save();
          return res.status(200).json(ticketType);
        } catch (err) {
          return res
            .status(500)
            .json({ code: 500, message: "Internal Server Error" });
        }
      },
    );
  }

  // Delete (réservé aux organisateurs)
  delete() {
    this.app.delete("/tickets/:id", authToken, async (req, res) => {
      try {
        const ticketType = await TicketTypeModel.findById(req.params.id);
        if (!ticketType) {
          return res
            .status(404)
            .json({ code: 404, message: "Ticket type not found" });
        }

        const event = await EventModel.findById(ticketType.event);
        const isOrganizer = event?.organizers.some(
          (id) => id.toString() === req.user.id,
        );
        if (!isOrganizer) {
          return res.status(403).json({
            code: 403,
            message: "Only event organizers can delete ticket types",
          });
        }

        await TicketTypeModel.findByIdAndDelete(req.params.id);
        return res.status(200).json(ticketType);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Search
  search() {
    this.app.get("/tickets", authToken, async (req, res) => {
      try {
        const filter = {};
        if (req.query.name)
          filter.name = { $regex: req.query.name, $options: "i" };
        if (req.query.event) filter.event = req.query.event;

        const ticketTypes = await TicketTypeModel.find(filter);
        return res.status(200).json(ticketTypes);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Achat d'un billet par une personne extérieure (1 seul billet max par personne sur l'événement)
  buy() {
    this.app.post(
      "/tickets/:id/buy",
      check.body(checkBuy),
      async (req, res) => {
        try {
          const ticketType = await TicketTypeModel.findById(req.params.id);
          if (!ticketType) {
            return res
              .status(404)
              .json({ code: 404, message: "Ticket type not found" });
          }

          if (ticketType.tickets.length >= ticketType.quantity) {
            return res.status(400).json({ code: 400, message: "Sold out" });
          }

          // Vérifie que la personne n'a pas déjà acheté un billet pour cet événement (tous types confondus)
          const buyerEmail = req.body.email.toLowerCase().trim();
          const existingPurchase = await TicketTypeModel.findOne({
            event: ticketType.event,
            "tickets.email": buyerEmail,
          });

          if (existingPurchase) {
            return res.status(409).json({
              code: 409,
              message:
                "This person has already purchased a ticket for this event",
            });
          }

          ticketType.tickets.push({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: buyerEmail,
            address: req.body.address,
            purchasedAt: new Date(),
          });

          await ticketType.save();
          const createdTicket =
            ticketType.tickets[ticketType.tickets.length - 1];
          return res.status(201).json(createdTicket);
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
    this.buy();
  }
};

export default Tickets;
