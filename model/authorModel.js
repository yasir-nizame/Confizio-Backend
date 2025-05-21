import mongoose from "mongoose";

const authorSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String },
  email: { type: String, required: true },
  country: { type: String },
  affiliation: { type: String },
  webPage: { type: String },
  researchPapers: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "ResearchPaper", // Array to store multiple ResearchPaper IDs
    },
  ],
  conferences: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "Conference", // Array to store multiple Conference IDs
    },
  ],
  userConferenceId: {
    type: mongoose.Schema.ObjectId,
    ref: "UserConference", // Reference to UserConference
  },
  correspondingAuthor: { type: Boolean, default: false }, //it's like a lead author
});

export default mongoose.model("Author", authorSchema);
