import Conference from "../model/conferenceModel.js";
import ResearchPaper from "../model/researchPaperModel.js";
import userModel from "../model/userModel.js";
import userConference from "../model/userConferenceModel.js";
import Assignments from "../model/assignmentModel.js";
export const createConferenceController = async (req, res) => {
  try {
    const {
      userId,
      conferenceName,
      acronym,
      webPage,
      venue,
      city,
      country,
      startDate,
      endDate,
      abstractDeadline,
      submissionDeadline,
      primaryArea,
      secondaryArea,
      topics,
      expertise,
    } = req.body;

    // Ensure expertise is an array
    if (!Array.isArray(expertise)) {
      return res.status(400).json({ message: "Expertise must be an array." });
    }

    // Remove empty or invalid values from expertise array
    // const sanitizedExpertise = expertise
    //   .map((exp) => (typeof exp === "string" ? exp.trim() : exp))
    //   .filter((exp) => exp); // Remove empty strings

    // Check for duplicate conferences
    const existingConference = await Conference.findOne({
      $or: [{ conferenceName }, { acronym }],
    });

    if (existingConference) {
      return res.status(400).json({
        message: "A conference with the same name or acronym already exists.",
      });
    }

    // Validate required fields
    if (
      !conferenceName ||
      !acronym ||
      !startDate ||
      !endDate ||
      !expertise.length
    ) {
      return res.status(400).json({
        message:
          "Conference name, acronym, start date, expertise, and end date are required.",
      });
    }

    // Convert startDate and endDate to Date objects
    const startDateWithTime = new Date(startDate);
    const endDateWithTime = new Date(endDate);

    if (isNaN(startDateWithTime) || isNaN(endDateWithTime)) {
      return res.status(400).json({
        message: "Invalid date format for startDate or endDate.",
      });
    }

    // Construct submission link
    const submissionLink = `${process.env.BASE_URL}/conference/${acronym}/submit-paper/${acronym}`;
    // ✅ Get organizer details
    const organizerUser = await Users.findById(userId);
    if (!organizerUser) {
      return res.status(404).json({ message: "Organizer user not found." });
    }

    // Create a new conference instance
    const newConference = new Conference({
      conferenceName,
      acronym,
      webPage,
      venue,
      city,
      country,
      startDate: startDateWithTime,
      endDate: endDateWithTime,
      abstractDeadline,
      submissionDeadline,
      primaryArea,
      secondaryArea,
      topics,
      status: "pending",
      submissionLink,
      organizer: userId,
      organizerName: organizerUser.name,
      organizerEmail: organizerUser.email,
      expertise, // Save sanitized expertise
    });

    // Save the conference
    await newConference.save();

    // Manage user conference roles
    const existingUserConference = await userConference.findOne({ userId });

    if (existingUserConference) {
      const organizerRole = existingUserConference.roles.find(
        (role) => role.role === "organizer"
      );

      if (organizerRole) {
        organizerRole.conferences.push(newConference._id);
      } else {
        existingUserConference.roles.push({
          role: "organizer",
          conferences: [newConference._id],
        });
      }

      await existingUserConference.save();
    } else {
      await userConference.create({
        userId,
        roles: [{ role: "organizer", conferences: [newConference._id] }],
      });
    }

    res.status(201).json({
      message: "Conference created successfully",
      conference: newConference,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating conference", error });
  }
};

//get conference by id

// Get Conference Controller
export const getConferenceController = async (req, res) => {
  try {
    const { id } = req.params; // Extracting the ID from request parameters
    if (!id) {
      return res.status(404).json({ message: "ID NOT FOUND" });
    }

    // Find the conference by ID and populate associated papers
    const conference = await Conference.findById(id).populate({
      path: "papers", // Populate papers
      populate: {
        path: "authors", // Populate authors within papers
        select: "firstName email", // Only select required fields
      },
    });

    // Check if the conference exists
    if (!conference) {
      return res.status(404).json({ message: "Conference not found." });
    }

    res.status(200).json(conference);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving conference", error });
  }
};

// Get All Conferences
export const getAllConferencesController = async (req, res) => {
  try {
    // Fetch all conferences from the database
    const conferences = await Conference.find();

    // Check if there are any conferences
    if (conferences.length === 0) {
      return res.status(404).json({ message: "No conferences found." });
    }

    res.status(200).json(conferences);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving conferences", error });
  }
};

// Update Conference Controller
export const updateConferenceController = async (req, res) => {
  try {
    const conferenceId = req.params.id; // Get conference ID from URL

    // Extract values from the body
    const {
      conferenceName,
      acronym,
      webPage,
      venue,
      city,
      country,
      startDate,
      endDate,
      abstractDeadline,
      submissionDeadline,
      primaryArea,
      secondaryArea,
      topics,
    } = req.body;

    // Create an object that only includes the fields that are present in the request body
    const updatedData = {};
    if (conferenceName) updatedData.conferenceName = conferenceName;
    if (acronym) updatedData.acronym = acronym;
    if (webPage) updatedData.webPage = webPage;
    if (venue) updatedData.venue = venue;
    if (city) updatedData.city = city;
    if (country) updatedData.country = country;
    if (startDate) updatedData.startDate = startDate;
    if (endDate) updatedData.endDate = endDate;
    if (abstractDeadline) updatedData.abstractDeadline = abstractDeadline;
    if (submissionDeadline) updatedData.submissionDeadline = submissionDeadline;
    if (primaryArea) updatedData.primaryArea = primaryArea;
    if (secondaryArea) updatedData.secondaryArea = secondaryArea;
    if (topics) updatedData.topics = topics;

    // Find and update the conference
    const updatedConference = await Conference.findByIdAndUpdate(
      conferenceId,
      { $set: updatedData }, // Only update provided fields
      { new: true } // Return the updated document
    );

    if (!updatedConference) {
      return res.status(404).json({ message: "Conference not found" });
    }

    res.status(200).json({
      message: "Conference updated successfully",
      conference: updatedConference,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating conference", error });
  }
};

// Delete Conference Controller
export const deleteConferenceController = async (req, res) => {
  try {
    const conferenceId = req.params.id; // Get conference ID from URL

    // Find and delete the conference
    const deletedConference = await Conference.findByIdAndDelete(conferenceId);

    if (!deletedConference) {
      return res.status(404).json({ message: "Conference not found" });
    }

    res.status(200).json({
      message: "Conference deleted successfully",
      conference: deletedConference,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting conference", error });
  }
};

//pending conferences
export const getPendingConferencesController = async (req, res) => {
  try {
    const pendingConferences = await Conference.find({ status: "pending" });
    res.status(200).json(pendingConferences);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving pending conferences", error });
  }
};

// all approved conferences
export const getApprovedConferencesController = async (req, res) => {
  try {
    const approvedConferences = await Conference.find({ status: "approved" });
    if (!approvedConferences) {
      return res.status(404).json({ message: "Conference not found." });
    }
    res.status(200).json(approvedConferences);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving approved conferences", error });
  }
};
// all rejected conferences
export const getRejectedConferencesController = async (req, res) => {
  try {
    const approvedConferences = await Conference.find({ status: "rejected" });
    if (!approvedConferences) {
      return res.status(404).json({ message: "Conference not found." });
    }
    res.status(200).json(approvedConferences);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving approved conferences", error });
  }
};

// Approve Conference
export const approveConferenceController = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedConference = await Conference.findByIdAndUpdate(
      id,
      { status: "approved" },
      { new: true }
    );
    if (!updatedConference) {
      return res.status(404).json({ message: "Conference not found" });
    }
    res
      .status(200)
      .json({ message: "Conference approved", conference: updatedConference });
  } catch (error) {
    res.status(500).json({ message: "Error approving conference", error });
  }
};

// Reject Conference
export const rejectConferenceController = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedConference = await Conference.findByIdAndUpdate(
      id,
      { status: "rejected" },
      { new: true }
    );
    if (!updatedConference) {
      return res.status(404).json({ message: "Conference not found" });
    }
    res
      .status(200)
      .json({ message: "Conference rejected", conference: updatedConference });
  } catch (error) {
    res.status(500).json({ message: "Error rejecting conference", error });
  }
};

//get conference by acronym
export const getConferenceByAcronymController = async (req, res) => {
  try {
    const { acronym } = req.params;

    const conference = await Conference.findOne({ acronym });
    if (!conference) {
      return res.status(404).json({ message: "Conference not found" });
    }

    res.status(200).json({ conferenceName: conference.conferenceName });
  } catch (error) {
    console.error("Error fetching conference:", error);
    res.status(500).json({ message: "Error fetching conference details" });
  }
};

export const getPapersByConferenceController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    // Fetch all papers for the given conference ID
    const papers = await ResearchPaper.find({ conferenceId })
      .populate("authors", "name email")
      .populate({
        path: "reviews",
        select: "reviewerId overallRecommendation technicalConfidence",
      })
      .populate("conferenceId", "conferenceName")
      .lean();

    const assignments = await Assignments.find()
      .populate("reviewerId", "name")
      .lean();

    const enrichedPapers = papers.map((paper) => {
      const paperAssignments = assignments.filter(
        (a) => String(a.paperId) === String(paper._id)
      );

      const reviewers = paperAssignments.map((assignment) => {
        const review = paper.reviews.find(
          (r) => String(r.reviewerId) === String(assignment.reviewerId._id)
        );

        return {
          name: assignment.reviewerId?.name || "Unknown Reviewer",
          status: review ? "reviewed" : "pending",
          recommendation: review?.overallRecommendation || "-",
          technicalConfidence:
            review?.technicalConfidence !== undefined
              ? Number(review.technicalConfidence.toFixed(2))
              : "0.00",
        };
      });

      return {
        ...paper,
        reviewers, // 👈 Add reviewers array to each paper
      };
    });

    if (enrichedPapers.length === 0) {
      return res
        .status(404)
        .json({ message: "No papers found for this conference." });
    }

    res.status(200).json({ papers: enrichedPapers });
  } catch (error) {
    console.error("Error fetching papers:", error);
    res.status(500).json({ message: "Error retrieving papers", error });
  }
};
