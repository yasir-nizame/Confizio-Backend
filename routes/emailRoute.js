import express from "express";
import { sendInvitationController } from "../controller/emailController.js";
// import { isConferenceOrganizer } from "../middleware/conferenceMiddleware.js";

//router object
const router = express.Router();

// Organizer sends invitations for a specific conference
router.post(
  "/invite-reviewers",
  // isConferenceOrganizer,
  sendInvitationController
);

export default router;
