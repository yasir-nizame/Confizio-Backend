import mongoose from "mongoose";

const InvitationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", default: null },
  email: { type: String, required: true },
  conferenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Conference" },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined"],
    default: "pending",
  },
  invitedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Invitation", InvitationSchema);
