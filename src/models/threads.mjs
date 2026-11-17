import mongoose from "mongoose";

const { Schema } = mongoose;

const commentSchema = new Schema({
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

const messageSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, trim: true },
  comments: [commentSchema],
  created_at: { type: Date, default: Date.now },
}).set("toJSON", {
  transform: (doc, ret) => {
    const retUpdated = ret;
    retUpdated.id = ret._id;
    delete retUpdated._id;
    return retUpdated;
  },
});

const threadSchema = new Schema({
  title: { type: String, required: true, trim: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", default: null },
  event: { type: Schema.Types.ObjectId, ref: "Event", default: null },
  messages: [messageSchema],
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

export default mongoose.model("Thread", threadSchema);
