import { comparePassword, hashPassword } from "../utils_helpers/authHelper.js";
import reviewerModel from "../model/reviwerModel.js";
import JWT from "jsonwebtoken";
import userModel from "../model/userModel.js";
import userConferenceModel from "../model/userConferenceModel.js";
import InvitationModel from "../model/InvitationModel.js";
import assignmentModel from "../model/assignmentModel.js";
import researchPaperModel from "../model/researchPaperModel.js";
import reviewForm from "../model/reviewFormModel.js";
import technicalWeightage from "../model/technicalWeightage.js";
export const reviewerRegisterController = async (req, res) => {
  try {
    const { name, email, password, expertise } = req.body;

    // Validations
    if (!name) {
      return res.send({ message: "Name is required" });
    }
    if (!email) {
      return res.send({ message: "Email is required" });
    }
    if (!password) {
      return res.send({ message: "Password is required" });
    }

    if (!expertise) {
      return res.send({
        message: "Expertise is required",
      });
    }

    const existingReviewer = await reviewerModel.findOne({ email });
    if (existingReviewer) {
      return res.status(200).send({
        success: false,
        message: "Reviewer already registered, please login directly",
      });
    }

    // Register reviewer
    const hashedPassword = await hashPassword(password);

    // Save
    const reviewer = await new reviewerModel({
      name,
      email,
      password: hashedPassword,
      expertise,
    }).save();



    res.status(201).send({
      success: true,
      message: "Registered successfully",
      reviewer,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Error in registration",
      error,
    });
  }
};

export const reviewerLoginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(404).send({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check reviewer
    const reviewer = await reviewerModel.findOne({ email });
    if (!reviewer) {
      return res.status(404).send({
        success: false,
        message: "Email is not registered",
      });
    }

    const match = await comparePassword(password, reviewer.password);
    if (!match) {
      return res.status(200).send({
        success: false,
        message: "Password not matched",
      });
    }

    const token = JWT.sign({ _id: reviewer._id }, process.env.JWT_SECRET, {
      expiresIn: "3d",
    });

    res.status(200).send({
      success: true,
      message: "Logged in successfully",
      reviewer: {
        _id: reviewer._id,
        name: reviewer.name,
        email: reviewer.email,
        expertise: reviewer.expertise,
      },
      token,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Error in login",
      error,
    });
  }
};

// Add this function in your controller

export const checkReviewerDetailsController = async (req, res) => {
  try {
    const { email, conferenceId } = req.query;

    // Check if the user exists
    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).send({ message: "User not found" });

    // Check if the user has already registered as a reviewer for the conference
    const userConference = await userConferenceModel.findOne({
      userId: user._id,
      "roles.role": "reviewer",
      "roles.conferences": conferenceId,
    });

    if (userConference) {
      return res.status(200).send({ exists: true });
    }

    return res.status(200).send({ exists: false });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error checking reviewer details" });
  }
};

export const getAcceptedReviewersController = async (req, res) => {
  try {
    const { conferenceId } = req.params; // Get conferenceId from request parameters

    if (!conferenceId) {
      return res.status(400).json({ error: "Conference ID is required." });
    }

    // Query to find all users with the 'reviewer' role for the given conference
    const reviewers = await userConferenceModel
      .find({
        "roles.role": "reviewer",
        "roles.conferences": conferenceId,
      })
      .select("userId") // Select only the userId for simplicity
      .populate("userId", "name email") // Populate user details like name and email if needed
      .exec();

    // Respond with the list of reviewers
    return res.status(200).json({
      success: true,
      data: reviewers,
    });
  } catch (error) {
    console.error("Error fetching reviewers:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while fetching reviewers.",
    });
  }
};

export const respondToInvitationController = async (req, res) => {
  try {
    const { conferenceId, status } = req.body;

    // Find the invitation in the database
    const invitation = await InvitationModel.findOne({
      conferenceId,
    });

    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found." });
    }

    // Update the invitation status
    invitation.status = status;
    await invitation.save();

    // If accepted, add user to the conference in UserConferenceModel
    if (status === "accepted") {
      await userConferenceModel.updateOne(
        { userId: invitation.userId },
        {
          $addToSet: { conferences: conferenceId }, // Add to conferences if not already present
        },
        { upsert: true } // Create the document if it doesn't exist
      );
    }

    return res
      .status(200)
      .json({ success: true, message: "Response recorded successfully." });
  } catch (error) {
    console.error("Error responding to invitation:", error);
    return res
      .status(500)
      .json({ success: false, error: "An error occurred." });
  }
};

// Get all papers assigned to a reviewer(test)
export const getAssignedPapersForReviewerController = async (req, res) => {
  const { reviewerId } = req.params;

  try {
    if (!reviewerId) {
      return res.status(400).json({ error: "Reviewer ID is required." });
    }

    // Fetch all assignments for the given reviewer
    const assignments = await assignmentModel
      .find({ reviewerId })
      .populate({
        path: "paperId",
        select:
          "title abstract keywords paperFilePath conferenceName conferenceAcronym authors status reviews isReviewedBy", // Include 'reviews' for each paper
        populate: {
          path: "authors",
          select: "firstName lastName email affiliation", // Select author fields
        },
      })
      .populate({
        path: "conferenceId",
        select: "name acronym", // Adjust conference fields if needed
      });

    if (!assignments || assignments.length === 0) {
      return res
        .status(404)
        .json({ error: "No assigned papers found for this reviewer." });
    }

    // Format response data and add 'hasReviewed' field
    const assignedPapers = assignments.map((assignment) => {
      const paper = assignment.paperId;

      return {
        paperId: paper._id,
        title: paper.title,
        abstract: paper.abstract,
        keywords: paper.keywords,
        paperFilePath: paper.paperFilePath,
        conferenceName: paper.conferenceName,
        conferenceAcronym: paper.conferenceAcronym,
        assignedAt: assignment.assignedAt,
        status: paper.status,
        authors: paper.authors.map((author) => ({
          firstName: author.firstName,
          lastName: author.lastName,
          email: author.email,
          affiliation: author.affiliation,
        })),
        isReviewedBy: paper.isReviewedBy ?? [], // Include isReviewedBy field
      };
    });

    res.status(200).json({
      success: true,
      data: assignedPapers,
    });
  } catch (error) {
    console.error("Error fetching assigned papers:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching assigned papers.",
    });
  }
};

export const submitReviewFormController = async (req, res) => {
  try {
    const {
      paperId,
      reviewerId,
      originality,
      technicalQuality,
      significance,
      clarity,
      relevance,
      overallRecommendation,
      commentsForAuthors,
      commentsForOrganizers,
    } = req.body;

    if (!paperId || !reviewerId) {
      return res
        .status(400)
        .json({ message: "Paper ID and Reviewer ID are required." });
    }

    // Fetch conferenceId from the paper
    const paper = await researchPaperModel.findById(paperId);
    if (!paper) {
      return res.status(404).json({ message: "Paper not found." });
    }

    const conferenceId = paper.conferenceId;

    // Get weightage for the conference
    let weightage = await technicalWeightage.findOne({ conferenceId });

    // Use default values if no custom weightage is set
    if (!weightage) {
      weightage = {
        originality: 30,
        technicalQuality: 25,
        significance: 20,
        clarity: 15,
        relevance: 10,
      };
    } else {
      // Log the custom weightage being used
  
    }

    // Calculate technical confidence
    const technicalConfidence =
      (originality * weightage.originality) / 100 +
      (technicalQuality * weightage.technicalQuality) / 100 +
      (significance * weightage.significance) / 100 +
      (clarity * weightage.clarity) / 100 +
      (relevance * weightage.relevance) / 100;

    // Create and save the review with technical confidence
    const review = new reviewForm({
      paperId,
      reviewerId,
      originality,
      technicalQuality,
      significance,
      clarity,
      relevance,
      overallRecommendation,
      commentsForAuthors,
      commentsForOrganizers,
      technicalConfidence, // Store in the database
    });

    const savedReview = await review.save();

    // Avoid changing the overall paper status to "reviewed"
    await researchPaperModel.findByIdAndUpdate(
      paperId,
      {
        $push: {
          reviews: savedReview._id,
          isReviewedBy: reviewerId,
        },
        $set: { status: "reviewed" },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Review submitted successfully.",
      review: savedReview,
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ message: "Failed to submit review." });
  }
};
