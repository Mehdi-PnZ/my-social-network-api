import mongoose from "mongoose";

const { Schema } = mongoose;

const shoppingItemSchema = new Schema({
  event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
  broughtBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  arrivalTime: { type: String, required: true, trim: true },
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

export default mongoose.model("ShoppingItem", shoppingItemSchema);
