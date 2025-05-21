import express from "express";
import {
  reviewerRegisterController,
  reviewerLoginController,
  checkReviewerDetailsController,
  getAcceptedReviewersController,
  respondToInvitationController,
  getAssignedPapersForReviewerController,
  submitReviewFormController,
} from "../controller/reviewerController.js";

import { checkIfReviewed } from "../middleware/authMiddleware.js";

//router object
const router = express.Router();

// Reviewer Registration Route
router.post("/register-reviewer", reviewerRegisterController);

// Reviewer Registration Route
router.post("/login-reviewer", reviewerLoginController);

//check reviewer details
router.post("/check-reviewer-details", checkReviewerDetailsController);

//check accepted invitations
router.get("/:conferenceId/reviewers", getAcceptedReviewersController);

// reponse to an invitation
router.post("/respond-invitation", respondToInvitationController);

// Route to get assigned papers for a reviewer
router.get(
  "/assigned-papers/reviewer/:reviewerId",
  getAssignedPapersForReviewerController
);

// Route to submit review form
router.post("/submit-reviewform", checkIfReviewed, submitReviewFormController);

export default router;
