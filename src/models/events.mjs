import mongoose from "mongoose";

const { Schema } = mongoose;

const eventSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  location: { type: String, required: true },
  coverPhoto: { type: String, default: "" },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  organizers: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
}).set("toJSON", {
  transform: (doc, ret) => {
    const retUpdated = ret;
    retUpdated.id = ret._id;
    delete retUpdated._id;
    delete retUpdated.__v;
    return retUpdated;
  },
});

export default mongoose.model("Event", eventSchema);
