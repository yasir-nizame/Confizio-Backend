import express from "express";
import {
  getAllResearchPapersController,
  getResearchPaperByIdController,
  // submitPaperController,
  deletePaperController,
  updatePaperController,
  getUserConferencePapersController,
  checkComplianceController,
  submitPaperController,
} from "../controller/authorController.js";
import upload from "../middleware/multer.js";

//router object
const router = express.Router();

//checks compliance of the paper
router.post(
  "/check-compliance",
  upload.single("paper"),
  checkComplianceController
);

router.post("/submit-paper", upload.single("paper"), submitPaperController);

// Route to get a specific research paper by ID
router.get("/research-paper/:id", getResearchPaperByIdController);

// Route to get all research papers
router.get("/all-research-papers", getAllResearchPapersController);

//Update paper details
router.put(
  "/update-paper-details/:id",
  upload.single("paper"),
  updatePaperController
);

//Delete paper
router.delete("/delete-paper/:id/:conferenceId", deletePaperController);

//get papers by user id
router.get("/:userId/:conferenceId/papers", getUserConferencePapersController);

export default router;
