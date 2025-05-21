import express from "express";
import {
  createConferenceController,
  getConferenceController,
  getAllConferencesController,
  updateConferenceController,
  deleteConferenceController,
  getApprovedConferencesController,
  rejectConferenceController,
  approveConferenceController,
  getPendingConferencesController,
  getRejectedConferencesController,
  getConferenceByAcronymController,
  getPapersByConferenceController,
} from "../controller/conferenceController.js";

const router = express.Router();

// Route to create a new conference
router.post("/create-conference", createConferenceController);

// Route to get a specific conference by ID
router.get("/get-conference/:id", getConferenceController);

// Route to get all approved conferences
router.get("/all-conferences", getApprovedConferencesController);

// Route to get all rejected conferences
router.get("/rejected-conferences", getRejectedConferencesController);

// Route to get all conferences
router.get("/all-reg-conferences", getAllConferencesController);

// update conference
router.put("/update-conference/:id", updateConferenceController);

// delete conference
router.delete("/delete-conference/:id", deleteConferenceController);

// Approve conference
router.put("/approve/:id", approveConferenceController);

// Reject conference
router.put("/reject/:id", rejectConferenceController);

//get all pending requests
router.get("/pending", getPendingConferencesController);

//get all conferences by acronyms
router.get('/:acronym',getConferenceByAcronymController);

//get all papers of the conference
router.get("/:conferenceId/papers", getPapersByConferenceController);

export default router;

