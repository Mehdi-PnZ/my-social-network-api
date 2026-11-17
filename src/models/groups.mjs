import mongoose from "mongoose";

const { Schema } = mongoose;

const groupSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  icon: { type: String, default: "" },
  coverPhoto: { type: String, default: "" },
  type: {
    type: String,
    enum: ["public", "private", "secret"],
    default: "public",
  },
  allowMemberPosts: { type: Boolean, default: true },
  allowMemberEvents: { type: Boolean, default: false },
  admins: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  members: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
}).set("toJSON", {
  transform: (doc, ret) => {
    const retUpdated = ret;
    retUpdated.id = ret._id;
    delete retUpdated._id;
    delete retUpdated.__v;
    return retUpdated;
  },
});

export default mongoose.model("Group", groupSchema);
