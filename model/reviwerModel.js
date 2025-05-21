import mongoose from "mongoose";

const reviewerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "reviewer" },
  conferences: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Conference", required: true },
  ],
  expertise: { type: [String], required: true },
});

export default mongoose.model("Reviewer", reviewerSchema);
