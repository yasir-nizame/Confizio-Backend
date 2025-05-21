import express from "express";
import {
  assignPapersToReviewersController,
  getAssignmentsByConferenceController,
  getReviewManagementDataController,
  getReviewsByPaperIdController,
  updateFinalDecisionController,
  manuallyAssignPaperController,
  setTechnicalWeightageController,
  getTechnicalWeightageController,
  getAssignmentsByPaperController,
  getReviewsOfAllPapersController,
  handleProceedingsUploadController,
  fetchAcceptedPapersController,
  proceedingsPdfGenerationController,
} from "../controller/organizerController.js";
import upload from "../middleware/multer.js";

//router object
const router = express.Router();

// Organizer assigns papers to reviewers in this conference
router.post("/assign-papers/:id", assignPapersToReviewersController);

// POST route to manually assign a paper
router.post("/assign-paper-manual", manuallyAssignPaperController);

//fetch assignments
router.get(
  "/assigned-papers/:conferenceId",
  getAssignmentsByConferenceController
);

//fetch reviews
router.get(
  "/review-management/:conferenceId",
  getReviewManagementDataController
);

//fetch reviews of specific paper
router.get("/reviews/:paperId", getReviewsByPaperIdController);

//fetch reviews of all papers
router.get("/reviews/all-papers", getReviewsOfAllPapersController);

//update decision
router.post("/update-decision", updateFinalDecisionController);

//set technical weightage
router.post("/set-technical-weightage", setTechnicalWeightageController);

//get technical weightage
router.get(
  "/get-technical-weightage/:conferenceId",
  getTechnicalWeightageController
);

//get assiments coutn for a paper
router.post("/papers/assigned-reviewers", getAssignmentsByPaperController);

// Route to upload proceedings file

// router.post(
//   "/upload-proceedings",
//   upload.single("proceedingsIntro"),
//   handleProceedingsUploadController
// );

//get technical weightage
router.get(
  "/get-proceedings-data/:conferenceId",
  fetchAcceptedPapersController
);

router.post(
  "/upload-proceedings/:conferenceId",
  upload.single("proceedingsIntro"),
  proceedingsPdfGenerationController
);

export default router;
