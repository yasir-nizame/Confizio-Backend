import JWT from "jsonwebtoken";
import userModel from "../model/userModel.js";
import UserConferenceModel from "../model/userConferenceModel.js";
import Review from "../model/reviewFormModel.js";


export const requireLogin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        name: "JsonWebTokenError",
        message: "No token provided or invalid format",
      });
    }
    const token = authHeader;
    const decode = JWT.verify(token, process.env.JWT_SECRET);
    req.user = decode;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        name: "TokenExpiredError",
        message: "Token has expired",
      });
    }
    return res.status(401).json({
      success: false,
      name: "JsonWebTokenError",
      message: "Invalid token",
    });
  }
};
export const isAdmin = async (req, res, next) => {
  try {
    //check user if admin or nt
    const user = await userModel.findById(req.user._id);
    if (user.role !== 1) {
      return res.status(400).send({
        success: false,
        message: "Unauthorized Access",
      });
    } else {
      next();
    }
  } catch (error) {
    return res.status(401).send({
      success: false,
      message: "Error in Admin middleware",
      error,
    });
  }
};

export const validateRole = (role) => {
  return async (req, res, next) => {
    const userId = req.user?.id; // Assuming user ID is available in `req.user`.
    const { conferenceId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    if (!conferenceId) {
      return res.status(400).json({ message: "Conference ID is required." });
    }

    try {
      const userRoles = await UserConferenceModel.findOne({ userId });

      if (!userRoles) {
        return res.status(404).json({ message: "User roles not found." });
      }

      const hasRole = userRoles.roles.some(
        (roleObj) =>
          roleObj.role === role && roleObj.conferences.includes(conferenceId)
      );

      if (!hasRole) {
        return res
          .status(403)
          .json({ message: "Access denied. Insufficient permissions." });
      }

      next(); // Proceed to the next middleware or route handler
    } catch (error) {
      console.error(
        `[validateRole:${role}] Error fetching user roles for userId ${userId}:`,
        error
      );
      res.status(500).json({ message: "Internal server error." });
    }
  };
};

// Role-specific middlewares
export const isOrganizer = validateRole("organizer");
export const isReviewer = validateRole("reviewer");
export const isAuthor = validateRole("author");

export const checkIfReviewed = async (req, res, next) => {
  const { paperId, reviewerId } = req.body; // Assuming the request body has these fields

  try {
    // Check if a review already exists for this paper by the reviewer
    const existingReview = await Review.findOne({ paperId, reviewerId });

    if (existingReview) {
      // If a review already exists, send an error response
      return res
        .status(400)
        .json({ message: "You have already reviewed this paper." });
    }

    // If no review exists, proceed to the next middleware or handler
    next();
  } catch (error) {
    // Handle any errors that occur during the check
    console.error(error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
