import mongoose from "mongoose";

const { Schema } = mongoose;

const photoCommentSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, trim: true },
  created_at: { type: Date, default: Date.now },
}).set("toJSON", {
  transform: (doc, ret) => {
    const retUpdated = ret;
    retUpdated.id = ret._id;
    delete retUpdated._id;
    return retUpdated;
  },
});

const photoSchema = new Schema({
  url: { type: String, required: true, trim: true },
  caption: { type: String, default: "", trim: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  comments: [photoCommentSchema],
  created_at: { type: Date, default: Date.now },
}).set("toJSON", {
  transform: (doc, ret) => {
    const retUpdated = ret;
    retUpdated.id = ret._id;
    delete retUpdated._id;
    return retUpdated;
  },
});

const albumSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
  event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
  photos: [photoSchema],
  created_at: { type: Date, default: Date.now },
}).set("toJSON", {
  transform: (doc, ret) => {
    const retUpdated = ret;
    retUpdated.id = ret._id;
    delete retUpdated._id;
    delete retUpdated.__v;
    return retUpdated;
  },
});

export default mongoose.model("Album", albumSchema);
