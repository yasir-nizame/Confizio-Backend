import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["author", "organizer", "reviewer", "user"],
    default: "user", // Default value defined here
    required: true,
  },
  conferences: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conference",
      required: true,
    },
  ],
  // Add expertise for reviewers
  expertise: {
    type: [String], // Array of strings to store multiple areas of expertise
    required: function () {
      return this.role === "reviewer";
    },
  },
});

const userConferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    roles: [roleSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("UserConference", userConferenceSchema);
