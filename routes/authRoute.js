import express from "express";
import {
  registerController,
  loginController,
  forgotPasswordController,
  updateProfileController,
  getUserRolesController,
  getUserConferencesByRole,
} from "../controller/authController.js";
import {
  requireLogin,
  isAdmin,
  isOrganizer,
  isReviewer,
  isAuthor,
} from "../middleware/authMiddleware.js";

//router object
const router = express.Router();

//register
router.post("/register", registerController);

//login
router.post("/login", loginController);

//forgot password
router.post("/forgot-password", forgotPasswordController);

//protected routes
// user
router.get("/user-auth", requireLogin, (req, res) => {
  res.status(200).send({
    ok: true,
  });
});

// admin
router.get("/admin-auth", requireLogin, isAdmin, (req, res) => {
  res.status(200).send({
    ok: true,
  });
});

// Organizer Route
router.get("/organizer-dashboard/:conferenceId", isOrganizer, (req, res) => {
  res.json({ message: "Welcome to the Organizer Dashboard!" });
});

// Reviewer Route
router.get("/reviewer-dashboard/:conferenceId", isReviewer,(req, res) => {
  res.json({ message: "Welcome to the Reviewer Dashboard!" });
});

// Author Route
router.get("/author-dashboard/:conferenceId", isAuthor, (req, res) => {
  res.json({ message: "Welcome to the Author Dashboard!" });
});

router.put("/profile", requireLogin, updateProfileController);

router.get("/user-roles/:userId", getUserRolesController);

//get all conferences for a specific role
router.get("/conferences/:userId", getUserConferencesByRole);

export default router;
