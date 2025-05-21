import mongoose from "mongoose";

const userschema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    recovery_key: {
      type: String,
      required: true,
    },
    role: {
      type: Number,
      default: 0, //user , 1 = admin
    },
    conference_role: [
      {
        conferenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Conference" },
        role: { type: String, enum: ["author", "organizer"], required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Users", userschema);
