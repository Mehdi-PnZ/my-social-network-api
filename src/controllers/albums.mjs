import Validator from "better-validator";
import authToken from "../helper/auth-token.mjs";
import AlbumModel from "../models/albums.mjs";
import EventModel from "../models/events.mjs";

const check = Validator.expressMiddleware();

const checkCreate = (body) => {
  body("title").required().isString().notEmpty();
  body("description").isString();
  body("event").required().isString().notEmpty();
  body().strict();
};

const checkUpdate = (body) => {
  body("title").isString().notEmpty();
  body("description").isString();
  body().strict();
};

const checkAddPhoto = (body) => {
  body("url").required().isString().notEmpty();
  body("caption").isString();
  body().strict();
};

const checkComment = (body) => {
  body("content").required().isString().notEmpty();
  body().strict();
};

const isEventMember = (event, userId) =>
  event.organizers.some((id) => id.toString() === userId) ||
  event.participants.some((id) => id.toString() === userId);

const Albums = class Albums {
  constructor(app) {
    this.app = app;
    this.run();
  }

  // Create
  create() {
    this.app.post(
      "/albums",
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

          if (!isEventMember(event, req.user.id)) {
            return res.status(403).json({
              code: 403,
              message:
                "Only event organizers or participants can create an album",
            });
          }

          const album = new AlbumModel({
            title: req.body.title,
            description: req.body.description || "",
            event: req.body.event,
          });

          await album.save();
          return res.status(201).json(album);
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
    this.app.get("/albums/:id", authToken, async (req, res) => {
      try {
        const album = await AlbumModel.findById(req.params.id)
          .populate("photos.uploadedBy", "firstName lastName")
          .populate("photos.comments.author", "firstName lastName");

        if (!album) {
          return res
            .status(404)
            .json({ code: 404, message: "Album not found" });
        }

        return res.status(200).json(album);
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
      "/albums/:id",
      authToken,
      check.body(checkUpdate),
      async (req, res) => {
        try {
          const album = await AlbumModel.findById(req.params.id);
          if (!album) {
            return res
              .status(404)
              .json({ code: 404, message: "Album not found" });
          }

          const event = await EventModel.findById(album.event);
          if (!event || !isEventMember(event, req.user.id)) {
            return res.status(403).json({
              code: 403,
              message:
                "Only event organizers or participants can update this album",
            });
          }

          Object.assign(album, req.body);
          await album.save();
          return res.status(200).json(album);
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
    this.app.delete("/albums/:id", authToken, async (req, res) => {
      try {
        const album = await AlbumModel.findById(req.params.id);
        if (!album) {
          return res
            .status(404)
            .json({ code: 404, message: "Album not found" });
        }

        const event = await EventModel.findById(album.event);
        if (!event || !isEventMember(event, req.user.id)) {
          return res.status(403).json({
            code: 403,
            message:
              "Only event organizers or participants can delete this album",
          });
        }

        await AlbumModel.findByIdAndDelete(req.params.id);
        return res.status(200).json(album);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Search
  search() {
    this.app.get("/albums", authToken, async (req, res) => {
      try {
        const filter = {};
        if (req.query.title)
          filter.title = { $regex: req.query.title, $options: "i" };
        if (req.query.event) filter.event = req.query.event;

        const albums = await AlbumModel.find(filter);
        return res.status(200).json(albums);
      } catch (err) {
        return res
          .status(500)
          .json({ code: 500, message: "Internal Server Error" });
      }
    });
  }

  // Ajouter une photo dans l'album (participants ou organisateurs de l'événement)
  addPhoto() {
    this.app.post(
      "/albums/:id/photos",
      authToken,
      check.body(checkAddPhoto),
      async (req, res) => {
        try {
          const album = await AlbumModel.findById(req.params.id);
          if (!album) {
            return res
              .status(404)
              .json({ code: 404, message: "Album not found" });
          }

          const event = await EventModel.findById(album.event);
          if (!event || !isEventMember(event, req.user.id)) {
            return res.status(403).json({
              code: 403,
              message: "Only event organizers or participants can post photos",
            });
          }

          album.photos.push({
            url: req.body.url,
            caption: req.body.caption || "",
            uploadedBy: req.user.id,
          });

          await album.save();
          return res.status(201).json(album);
        } catch (err) {
          return res
            .status(500)
            .json({ code: 500, message: "Internal Server Error" });
        }
      },
    );
  }

  // Commenter une photo de l'album (participants ou organisateurs de l'événement)
  addPhotoComment() {
    this.app.post(
      "/albums/:id/photos/:photoId/comments",
      authToken,
      check.body(checkComment),
      async (req, res) => {
        try {
          const album = await AlbumModel.findById(req.params.id);
          if (!album) {
            return res
              .status(404)
              .json({ code: 404, message: "Album not found" });
          }

          const event = await EventModel.findById(album.event);
          if (!event || !isEventMember(event, req.user.id)) {
            return res.status(403).json({
              code: 403,
              message:
                "Only event organizers or participants can comment on photos",
            });
          }

          const photo = album.photos.id(req.params.photoId);
          if (!photo) {
            return res
              .status(404)
              .json({ code: 404, message: "Photo not found" });
          }

          photo.comments.push({
            author: req.user.id,
            content: req.body.content,
          });

          await album.save();
          return res.status(201).json(album);
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
    this.addPhoto();
    this.addPhotoComment();
  }
};

export default Albums;
