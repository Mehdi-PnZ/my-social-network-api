import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  created_at: { type: Date, default: Date.now },
}).set("toJSON", {
  transform: (doc, ret) => {
    const retUpdated = ret;
    retUpdated.id = ret._id;
    delete retUpdated._id;
    delete retUpdated.__v;
    delete retUpdated.password;
    return retUpdated;
  },
});

export default mongoose.model("User", userSchema);
