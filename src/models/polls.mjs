import mongoose from "mongoose";

const { Schema } = mongoose;

const voteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    optionIndex: { type: Number, required: true },
  },
  { _id: false },
);

const questionSchema = new Schema({
  questionText: { type: String, required: true, trim: true },
  options: [{ type: String, required: true, trim: true }],
  votes: [voteSchema],
}).set("toJSON", {
  transform: (doc, ret) => {
    const retUpdated = ret;
    retUpdated.id = ret._id;
    delete retUpdated._id;
    return retUpdated;
  },
});

const pollSchema = new Schema({
  title: { type: String, required: true, trim: true },
  event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
  questions: {
    type: [questionSchema],
    validate: [
      (val) => val.length > 0,
      "A poll must have at least one question",
    ],
  },
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

export default mongoose.model("Poll", pollSchema);
