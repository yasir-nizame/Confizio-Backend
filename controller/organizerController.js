import ResearchPaper from "../model/researchPaperModel.js";
import conferenceModel from "../model/conferenceModel.js";
import userConferenceModel from "../model/userConferenceModel.js";
import userModel from "../model/userModel.js";
import Assignment from "../model/assignmentModel.js";
import reviewFormModel from "../model/reviewFormModel.js";
import technicalWeightage from "../model/technicalWeightage.js";
import puppeteer from "puppeteer";
import supabase from "../config/supabase.js";
import express from "express";
import { titleCase } from "title-case";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const router = express.Router();


export const assignPapersToReviewersController = async (req, res) => {
  try {
    const { conferenceId } = req.body;
    const MAX_PAPERS_PER_REVIEWER = 5;
    const REVIEWERS_PER_PAPER = 3;

    if (!conferenceId) {
      return res.status(400).json({ error: "Conference ID is required." });
    }

    // Fetch all submitted papers with 'pending' status
    const papers = await ResearchPaper.find({
      conferenceId,
      status: "pending",
    });

    if (!papers || papers.length === 0) {
      return res.status(404).json({
        error: "No papers with 'pending' status found for this conference.",
      });
    }

    // Fetch all reviewers registered for the conference
    const reviewers = await userConferenceModel
      .find({ "roles.role": "reviewer", "roles.conferences": conferenceId })
      .select("userId roles.expertise")
      .populate("userId", "name email")
      .exec();

    if (!reviewers || reviewers.length === 0) {
      return res
        .status(404)
        .json({ error: "No reviewers found for this conference." });
    }

    // Initialize reviewer assignment tracking
    const reviewerAssignmentCount = reviewers.reduce((acc, reviewer) => {
      acc[reviewer.userId._id] = 0;
      return acc;
    }, {});

    // Helper function to find a reviewer with matching expertise and within limit
    const findMatchingReviewer = (keywords, assignedReviewers) => {
      for (const reviewer of reviewers) {
        if (
          reviewer.roles[0].expertise.some((exp) => keywords.includes(exp)) &&
          reviewerAssignmentCount[reviewer.userId._id] <
            MAX_PAPERS_PER_REVIEWER &&
          !assignedReviewers.includes(reviewer.userId._id)
        ) {
          return reviewer;
        }
      }
      return null;
    };

    const assignments = [];
    const warnings = []; // To store warnings for papers with < 3 reviewers
    const assignmentsByPaper = {}; // Track assignments per paper

    for (const paper of papers) {
      const keywords = paper.keywords || [];
      const assignedReviewers = [];

      // Attempt to assign up to 3 reviewers to each paper
      while (assignedReviewers.length < REVIEWERS_PER_PAPER) {
        let assignedReviewer = findMatchingReviewer(
          keywords,
          assignedReviewers
        );

        if (!assignedReviewer) {
          // Use round-robin if no expertise match
          assignedReviewer = reviewers.find(
            (r) =>
              reviewerAssignmentCount[r.userId._id] < MAX_PAPERS_PER_REVIEWER &&
              !assignedReviewers.includes(r.userId._id)
          );
        }

        if (assignedReviewer) {
          const assignment = new Assignment({
            paperId: paper._id,
            reviewerId: assignedReviewer.userId._id,
            conferenceId,
          });

          assignments.push(assignment);
          assignedReviewers.push(assignedReviewer.userId._id);
          reviewerAssignmentCount[assignedReviewer.userId._id] += 1;
          await assignment.save();
        } else {
          // Stop if no more reviewers are available
          break;
        }
      }

      // Update assignmentsByPaper
      if (assignedReviewers.length > 0) {
        assignmentsByPaper[paper._id] = {
          assignedCount: assignedReviewers.length,
          reviewers: assignedReviewers.map((reviewerId) => {
            const reviewer = reviewers.find(
              (r) => r.userId._id.toString() === reviewerId.toString()
            );
            return {
              _id: reviewerId,
              name: reviewer?.userId?.name,
              email: reviewer?.userId?.email,
            };
          }),
        };
      }

      // Update the paper status if at least 1 reviewer is assigned
      if (assignedReviewers.length > 0) {
        await ResearchPaper.findByIdAndUpdate(paper._id, {
          status: "assigned",
        });

        // Add warning if reviewers assigned are less than required
        if (assignedReviewers.length < REVIEWERS_PER_PAPER) {
          warnings.push({
            paperId: paper._id,
            title: paper.title,
            assignedReviewers: assignedReviewers.length,
            message: `Only ${assignedReviewers.length} reviewer(s) assigned to "${paper.title}".`,
          });
        }
      }
    }

    if (assignments.length === 0) {
      return res.status(404).json({ error: "No papers could be assigned." });
    }

    res.status(200).json({
      success: true,
      message: `${assignments.length} paper-reviewer assignments created.`,
      warnings:
        warnings.length > 0 ? warnings : "All papers assigned to 3 reviewers.",
    });
  } catch (error) {
    console.error("Error assigning papers:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while assigning papers.",
    });
  }
};
// Controller to fetch assignments for a conference
export const getAssignmentsByConferenceController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    if (!conferenceId) {
      return res.status(400).json({ error: "Conference ID is required." });
    }

    // Fetch all assignments for the given conference
    const assignments = await Assignment.find({ conferenceId })
      .populate("paperId", "title keywords authors")
      .populate("reviewerId", "name email")
      .exec();

    if (!assignments || assignments.length === 0) {
      return res
        .status(404)
        .json({ error: "No assignments found for this conference." });
    }
    // Fetch all papers with their assigned reviewers
    const papersWithAssignments = await Assignment.aggregate([
      { $match: { conferenceId } },
      {
        $group: {
          _id: "$paperId",
          assignedReviewers: { $push: "$reviewerId" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: assignments,
      papersWithAssignments,
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching assignments.",
    });
  }
};

// testing review maanagemnt
export const getReviewManagementDataController = async (req, res) => {
  try {
    const { conferenceId } = req.params; // Fetch conference ID from req.params

    // Fetch papers only for the given conference ID
    const papers = await ResearchPaper.find({ conferenceId }) // Filter papers by conferenceId
      .populate({
        path: "reviews",
        select: "reviewerId overallRecommendation technicalConfidence", // Fetching specific fields
      })
      .populate("authors", "firstName email")
      .populate("conferenceId", "conferenceName")
      .lean();

    const assignments = await Assignment.find()
      .populate("reviewerId", "name")
      .populate("paperId", "title")
      .lean();

    const tableData = papers.map((paper) => {
      const paperAssignments = assignments.filter(
        (assignment) => String(assignment.paperId._id) === String(paper._id)
      );

      const reviewers = paperAssignments.map((assignment) => {
        const review = paper.reviews.find(
          (review) =>
            String(review.reviewerId) === String(assignment.reviewerId._id)
        );

        return {
          name: assignment.reviewerId
            ? assignment.reviewerId.name
            : "Unknown Reviewer",
          status: review ? "reviewed" : "pending",
          recommendation: review?.overallRecommendation || "-",
          technicalConfidence:
            review?.technicalConfidence !== undefined || null
              ? Number(review.technicalConfidence.toFixed(4))
              : "0.00",
        };
      });

      // Calculate the average technical confidence
      const totalTechConfidence = reviewers.reduce(
        (sum, r) => sum + (r.technicalConfidence || 0),
        0
      );
      const avgTechConfidence =
        reviewers.length > 0
          ? Number(totalTechConfidence / reviewers.length).toFixed(2)
          : "N/A";

      const authors = paper.authors.map((author) => ({
        name: author.firstName,
        email: author.email,
      }));

      return {
        paperId: paper._id,
        title: paper.title,
        reviewers,
        overallstatus: reviewers.every((r) => r.status === "reviewed")
          ? "Consensus"
          : "In Progress",
        status: paper.status,
        decision: paper.finaldecision, // Use the final decision made by the organizer
        avgTechConfidence, // Add avg technical confidence to response
        complianceScore: paper.complianceReport?.percentage ?? null, // Include compliance report
        authors,
        plagiarismReport: paper.plagiarismReport ?? null,
      };
    });

    res.status(200).json(tableData);
  } catch (error) {
    console.error("Error fetching review management data:", error);
    res.status(500).json({ message: "Error fetching data." });
  }
};

export const getReviewsByPaperIdController = async (req, res) => {
  try {
    const { paperId } = req.params;

    // Validate the paperId parameter
    if (!paperId) {
      return res.status(400).json({ error: "Paper ID is required." });
    }

    // Fetch reviews associated with the specific paper ID
    const reviews = await reviewFormModel
      .find({ paperId })
      .populate("reviewerId", "name email") // Adjust fields as per the Users model
      .exec();

    if (!reviews || reviews.length === 0) {
      return res
        .status(404)
        .json({ message: "No reviews found for this paper." });
    }

    // Return the reviews
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching reviews." });
  }
};

export const getReviewsOfAllPapersController = async (req, res) => {
  try {
    const { paperIds } = req.body; // Expecting an array of paper IDs in the request body

    // Validate the input
    if (!paperIds || !Array.isArray(paperIds) || paperIds.length === 0) {
      return res
        .status(400)
        .json({ error: "A valid array of Paper IDs is required." });
    }

    // Fetch reviews for all paper IDs
    const reviews = await reviewFormModel
      .find({ paperId: { $in: paperIds } }) // Matches any paperId in the array
      .populate("reviewerId", "name email") // Adjust fields as per the Users model
      .exec();

    if (!reviews || reviews.length === 0) {
      return res
        .status(404)
        .json({ message: "No reviews found for the given papers." });
    }

    // Return the reviews
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching reviews." });
  }
};
export const updateFinalDecisionController = async (req, res) => {
  try {
    const { paperId, decision } = req.body;

    if (!paperId || !decision) {
      return res.status(400)({
        success: false,
        message: "Paper ID and decision are required.",
      });
    }

    // Ensure decision is valid
    const validDecisions = ["Accepted", "Rejected", "Modification Required"];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision value.",
      });
    }

    // Prepare update object
    const updateFields = { finaldecision: decision };

    // If decision is "Modification Required", also set status to "pending"
    if (decision === "Modification Required") {
      updateFields.status = "pending";
    }

    // Update the document
    const updatedPaper = await ResearchPaper.findByIdAndUpdate(
      paperId,
      updateFields,
      { new: true }
    );

    if (!updatedPaper) {
      return res.status(404).json({
        success: false,
        message: "Paper not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Decision updated successfully.",
      paper: updatedPaper,
    });
  } catch (error) {
    console.error("Error updating final decision:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

export const manuallyAssignPaperController = async (req, res) => {
  try {
    const { paperId, reviewerId, conferenceId } = req.body;

    if (!paperId || !reviewerId || !conferenceId) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Verify reviewerId exists in the database
    const reviewer = await userModel.findById(reviewerId); // Adjust model name as needed
    if (!reviewer) {
      return res.status(404).json({ error: "Reviewer not found." });
    }

    // Check if the paper already has 3 reviewers assigned
    const assignedReviewersCount = await Assignment.countDocuments({ paperId });

    if (assignedReviewersCount >= 3) {
      return res.status(400).json({
        error: "A paper cannot have more than 3 reviewers.",
      });
    }
    // Check if the reviewer is already assigned to this paper
    const existingAssignment = await Assignment.findOne({
      paperId,
      reviewerId,
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message:
          "Paper already assigned to this reviewer, please select another reviewer.",
      });
    }

    // Create a new assignment
    const newAssignment = new Assignment({
      paperId,
      reviewerId,
      conferenceId,
    });

    await newAssignment.save();

    // Update paper status to 'assigned' if at least one reviewer is assigned
    const totalAssignments = await Assignment.countDocuments({ paperId });
    if (totalAssignments > 0) {
      await ResearchPaper.findByIdAndUpdate(paperId, { status: "assigned" });
    }

    res.status(200).json({
      success: true,
      message: "Paper assigned to reviewer successfully!",
    });
  } catch (error) {
    console.error("Error in manual assignment:", error);
    res.status(500).json({ error: "Failed to manually assign paper." });
  }
};

export const setTechnicalWeightageController = async (req, res) => {
  try {
    const {
      conferenceId,
      originality,
      technicalQuality,
      significance,
      clarity,
      relevance,
    } = req.body;

    if (!conferenceId) {
      return res.status(400).json({ message: "Conference ID is required." });
    }

    // Ensure total weightage is 100%
    const total =
      originality + technicalQuality + significance + clarity + relevance;
    if (total !== 100) {
      return res
        .status(400)
        .json({ message: "Total weightage must be exactly 100%." });
    }

    // Find and update weightage for the conference
    const updatedWeightage = await technicalWeightage.findOneAndUpdate(
      { conferenceId },
      { originality, technicalQuality, significance, clarity, relevance },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Technical weightage updated successfully.",
      weightage: updatedWeightage,
    });
  } catch (error) {
    console.error("Error updating technical weightage:", error);
    res.status(500).json({ message: "Failed to update technical weightage." });
  }
};

export const getTechnicalWeightageController = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    if (!conferenceId) {
      return res.status(400).json({ message: "Conference ID is required." });
    }

    let weightage = await technicalWeightage.findOne({ conferenceId });

    // If no weightage is found, return default values
    if (!weightage) {
      weightage = {
        originality: 30,
        technicalQuality: 25,
        significance: 20,
        clarity: 15,
        relevance: 10,
      };
    }

    res.status(200).json(weightage);
  } catch (error) {
    console.error("Error fetching technical weightage:", error);
    res.status(500).json({ message: "Failed to fetch technical weightage." });
  }
};

export const getAssignmentsByPaperController = async (req, res) => {
  try {
    const { paperIds } = req.body; // Expecting an array of paperIds from request body

    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return res
        .status(400)
        .json({ error: "An array of Paper IDs is required." });
    }

    // Fetch assignments for the given paper IDs
    const assignments = await Assignment.find({ paperId: { $in: paperIds } })
      .populate("reviewerId", "name email") // Populate reviewer details
      .exec();

    // Group reviewers by paperId
    const assignmentsByPaper = {};
    assignments.forEach((assignment) => {
      const { paperId, reviewerId } = assignment;
      if (!assignmentsByPaper[paperId]) {
        assignmentsByPaper[paperId] = {
          assignedCount: 0,
          reviewers: [],
        };
      }
      assignmentsByPaper[paperId].assignedCount += 1;
      assignmentsByPaper[paperId].reviewers.push(reviewerId);
    });

    res.status(200).json({
      success: true,
      assignmentsByPaper, // Grouped assignments by paperId
    });
  } catch (error) {
    console.error("Error fetching assigned reviewers:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching assigned reviewers.",
    });
  }
};

export const handleProceedingsUploadController = async (req, res) => {
  const uploadedFile = req.file; // Single file from multer
  const { conferenceId } = req.body;

  // Validate inputs
  if (!conferenceId) {
    return res.status(400).json({ error: "Conference ID is required" });
  }
  if (!uploadedFile) {
    return res.status(400).json({ error: "Proceedings intro PDF is required" });
  }

  const proceedingsIntroBuffer = uploadedFile.buffer; // Get buffer directly

  try {
    // Validate conference existence
    const conference = await conferenceModel.findById(conferenceId);
    if (!conference) {
      return res.status(404).json({ error: "Conference not found" });
    }

    // 1. Fetch accepted papers
    const papers = await ResearchPaper.find({
      conference: conferenceId,
      finaldecision: "accepted",
    });

    // 2. Generate abstracts HTML
    const abstractsHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Abstracts</h1>
          ${papers
            .map(
              (p) => `
            <div style="margin-bottom: 20px;">
              <h3>${p.title}</h3>
              <p><strong>Authors:</strong> ${p.authors
                .map((a) => `${a.name} (${a.affiliation})`)
                .join(", ")}</p>
              <p><strong>Abstract:</strong> ${p.abstract}</p>
              <p><strong>Keywords:</strong> ${p.keywords.join(", ")}</p>
            </div>
          `
            )
            .join("")}
        </body>
      </html>
    `;

    // 3. Convert abstracts HTML to PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const pageHtml = await browser.newPage();
    await pageHtml.setContent(abstractsHtml);
    const abstractsPdfBytes = await pageHtml.pdf({
      format: "A4",
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
    });
    await browser.close();

    // 4. Create final PDF and merge: Proceedings Intro + Abstracts
    const finalPdf = await PDFDocument.create();

    // Add proceedings intro
    const introDoc = await PDFDocument.load(proceedingsIntroBuffer);
    let copiedPages = await finalPdf.copyPages(
      introDoc,
      introDoc.getPageIndices()
    );
    copiedPages.forEach((page) => finalPdf.addPage(page));

    // Add abstracts
    const abstractsDoc = await PDFDocument.load(abstractsPdfBytes);
    copiedPages = await finalPdf.copyPages(
      abstractsDoc,
      abstractsDoc.getPageIndices()
    );
    copiedPages.forEach((page) => finalPdf.addPage(page));

    // 5. Save final PDF to Supabase
    const finalPdfBytes = await finalPdf.save();
    const filename = `${conferenceId}-proceedings-${Date.now()}.pdf`;

    const { error } = await supabase.storage
      .from("proceedings-pdfs")
      .upload(filename, finalPdfBytes, { contentType: "application/pdf" });

    if (error) {
      console.error("Supabase error:", error);
      return res
        .status(500)
        .json({ error: `Supabase upload failed: ${error.message}` });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("proceedings-pdfs").getPublicUrl(filename);

    // 6. Update conference record
    await conferenceModel.findByIdAndUpdate(conferenceId, {
      proceedingsPdfUrl: publicUrl,
    });

    res
      .status(200)
      .json({ message: "Proceedings finalized", downloadUrl: publicUrl });
  } catch (err) {
    console.error("Error finalizing proceedings:", err);
    res.status(500).json({ error: "Failed to finalize proceedings" });
  }
};

export const fetchAcceptedPapersController = async (req, res) => {
  const { conferenceId } = req.params;

  if (!conferenceId) {
    return res.status(400).json({ error: "Conference ID is required" });
  }

  try {
    const papers = await ResearchPaper.find({
      conferenceId,
      finaldecision: "Accepted",
    })
      .populate("authors", "firstName lastName email country affiliation")
      .select("title abstract keywords authors");

    res.status(200).json(papers);
  } catch (err) {
    console.error("Error fetching papers:", err);
    res.status(500).json({ error: "Failed to fetch papers" });
  }
};

export const proceedingsPdfGenerationController = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const proceedingsIntro = req.file;
    const conferenceName = req.body.conferenceName;

    if (!proceedingsIntro) {
      return res.status(400).json({ error: "Missing proceedings Intro file" });
    }
    if (!conferenceId) {
      return res.status(400).json({ error: "Missing conference id" });
    }

    // Fetch accepted papers
    const papers = await ResearchPaper.find({
      conferenceId,
      finaldecision: "Accepted",
    })
      .populate("authors", "firstName lastName email country affiliation")
      .select("title abstract keywords authors");

    if (!papers || papers.length === 0) {
      return res.status(400).json({ error: "No accepted papers found" });
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const leftMargin = 50;
    const rightMargin = 50;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBoldFont = await pdfDoc.embedFont(
      StandardFonts.TimesRomanBold
    );

    // Add title page with proper spacing
    const titlePage = pdfDoc.addPage([pageWidth, pageHeight]);
    const fullConferenceTitle = conferenceName;
    const titleFontSize = 36;
    const titleLines = splitTextToFit(
      fullConferenceTitle,
      contentWidth,
      titleFontSize,
      timesRomanBoldFont
    );
    let yPosition = pageHeight - 120;
    for (const line of titleLines) {
      const titleWidth = timesRomanBoldFont.widthOfTextAtSize(
        line,
        titleFontSize
      );
      const titleX = leftMargin + (contentWidth - titleWidth) / 2;
      titlePage.drawText(line, {
        x: titleX,
        y: yPosition,
        size: titleFontSize,
        color: rgb(0, 0, 0),
        font: timesRomanBoldFont,
      });
      yPosition -= titleFontSize + 10;
    }
    titlePage.drawText("Conference Papers", {
      x:
        leftMargin +
        (contentWidth -
          timesRomanFont.widthOfTextAtSize("Conference Papers", 24)) /
          2,
      y: yPosition,
      size: 24,
      color: rgb(0, 0, 0),
      font: timesRomanFont,
    });

    yPosition = pageHeight - leftMargin; // Reset for content pages
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);

    for (const paper of papers) {
      // Check if there's enough space for the next paper section
      const estimatedHeight = estimatePaperHeight(
        paper,
        timesRomanFont,
        timesRomanBoldFont,
        contentWidth
      );
      if (yPosition - estimatedHeight < leftMargin) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - leftMargin;
      }

      const titleText = titleCase(paper.title);
      const titleFontSize = 14;
      const titleLines = splitTextToFit(
        titleText,
        contentWidth,
        titleFontSize,
        timesRomanBoldFont
      );
      for (const line of titleLines) {
        const textWidth = timesRomanBoldFont.widthOfTextAtSize(
          line,
          titleFontSize
        );
        const centeredX = leftMargin + (contentWidth - textWidth) / 2;

        currentPage.drawText(line, {
          x: centeredX,
          y: yPosition,
          size: titleFontSize,
          font: timesRomanBoldFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;
      }
      yPosition -= 20;

      // Authors and affiliations
      for (const author of paper.authors) {
        const authorName = titleCase(
          `${author.firstName} ${author.lastName || ""}`.trim()
        );
        const authorAffiliation = titleCase(author.affiliation || "");
        const authorCountry = titleCase(author.country || "");
        const authorEmail = author.email || "";

        currentPage.drawText(authorName, {
          x:
            leftMargin +
            (contentWidth - timesRomanFont.widthOfTextAtSize(authorName, 12)) /
              2,
          y: yPosition,
          size: 12,
          font: timesRomanFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        currentPage.drawText(authorAffiliation, {
          x:
            leftMargin +
            (contentWidth -
              timesRomanFont.widthOfTextAtSize(authorAffiliation, 10)) /
              2,
          y: yPosition,
          size: 10,
          font: timesRomanFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        currentPage.drawText(authorCountry, {
          x:
            leftMargin +
            (contentWidth -
              timesRomanFont.widthOfTextAtSize(authorCountry, 10)) /
              2,
          y: yPosition,
          size: 10,
          font: timesRomanFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        if (authorEmail) {
          currentPage.drawText(authorEmail, {
            x:
              leftMargin +
              (contentWidth -
                timesRomanFont.widthOfTextAtSize(authorEmail, 10)) /
                2,
            y: yPosition,
            size: 10,
            font: timesRomanFont,
            color: rgb(0, 0, 0),
          });
          yPosition -= 15;
        }
        yPosition -= 10;
      }
      yPosition -= 20;

      // Abstract heading

      currentPage.drawText("ABSTRACT", {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: timesRomanBoldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      // Improved justified abstract text
      const abstractText = paper.abstract;
      const abstractFontSize = 12;
      const abstractParagraphs = abstractText.split(/\n\n+/);

      for (const paragraph of abstractParagraphs) {
        const justifiedLines = improvedJustifyText(
          paragraph,
          contentWidth,
          abstractFontSize,
          timesRomanFont
        );

        for (const line of justifiedLines) {
          // Check if we need a new page
          if (yPosition < leftMargin + 20) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - leftMargin;
          }

          // Draw each word with precise spacing
          let xPosition = leftMargin;
          for (let i = 0; i < line.words.length; i++) {
            const word = line.words[i];
            currentPage.drawText(word, {
              x: xPosition,
              y: yPosition,
              size: abstractFontSize,
              font: timesRomanFont,
              color: rgb(0, 0, 0),
            });

            // Add the calculated space after each word (except the last)
            if (i < line.words.length - 1) {
              xPosition +=
                timesRomanFont.widthOfTextAtSize(word, abstractFontSize) +
                line.spaceWidth;
            }
          }
          yPosition -= abstractFontSize + 3; // Line spacing
        }
        yPosition -= 10; // Paragraph spacing
      }
      yPosition -= 30; // Space after abstract
    }

    // Merge with the proceedings intro PDF
    const finalPdf = await PDFDocument.create();
    const introPdf = await PDFDocument.load(proceedingsIntro.buffer);
    const papersPdf = await pdfDoc.save();

    const introPages = await finalPdf.copyPages(
      introPdf,
      introPdf.getPageIndices()
    );
    introPages.forEach((page) => finalPdf.addPage(page));

    const paperPages = await finalPdf.copyPages(
      await PDFDocument.load(papersPdf),
      (await PDFDocument.load(papersPdf)).getPageIndices()
    );
    paperPages.forEach((page) => finalPdf.addPage(page));

    // Save final PDF to Supabase
    const finalPdfBytes = await finalPdf.save();
    const filename = `${conferenceId}-proceedings-${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("proceedings-pdfs")
      .upload(filename, finalPdfBytes, { contentType: "application/pdf" });

    if (uploadError) {
      console.error("Supabase error:", uploadError);
      return res
        .status(500)
        .json({ error: `Supabase upload failed: ${uploadError.message}` });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("proceedings-pdfs").getPublicUrl(filename);

    await conferenceModel.findByIdAndUpdate(conferenceId, {
      proceedingsPdfUrl: publicUrl,
    });

    res
      .status(200)
      .json({ message: "Proceedings finalized", downloadUrl: publicUrl });
  } catch (error) {
    console.error("Error finalizing proceedings:", error);
    res.status(500).json({ error: "Failed to finalize proceedings" });
  }
};

// Helper function to split text for wrapping
const splitTextToFit = (text, maxWidth, fontSize, font) => {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

// Improved text justification function that returns words with precise spacing calculations
const improvedJustifyText = (text, maxWidth, fontSize, font) => {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLineWords = [];
  let currentLineWidth = 0;

  // Calculate the width of a normal space
  const normalSpaceWidth = font.widthOfTextAtSize(" ", fontSize);

  for (const word of words) {
    const wordWidth = font.widthOfTextAtSize(word, fontSize);

    // Calculate width with this word added
    const spaceWidth = currentLineWords.length > 0 ? normalSpaceWidth : 0;
    const newWidth = currentLineWidth + wordWidth + spaceWidth;

    if (newWidth <= maxWidth) {
      // Add word to current line
      currentLineWords.push(word);
      currentLineWidth = newWidth;
    } else {
      // Process completed line
      if (currentLineWords.length > 0) {
        // Calculate justified spacing
        const lineResult = calculateJustifiedSpacing(
          currentLineWords,
          currentLineWidth - (currentLineWords.length - 1) * normalSpaceWidth,
          maxWidth,
          fontSize,
          font
        );
        lines.push(lineResult);
      }

      // Start new line with current word
      currentLineWords = [word];
      currentLineWidth = wordWidth;
    }
  }

  // Handle the last line (not justified, left-aligned)
  if (currentLineWords.length > 0) {
    lines.push({
      words: currentLineWords,
      spaceWidth: normalSpaceWidth, // Normal spacing for last line
      isLastLine: true,
    });
  }

  return lines;
};

// Helper function to calculate precise justified spacing between words
const calculateJustifiedSpacing = (
  words,
  totalWordWidth,
  maxWidth,
  fontSize,
  font
) => {
  if (words.length === 1) {
    // Single word lines can't be justified
    return {
      words: words,
      spaceWidth: 0,
      isLastLine: false,
    };
  }

  // Calculate total space to distribute
  const totalSpaceToDistribute = maxWidth - totalWordWidth;

  // Calculate space width between words for justified text
  const spaceWidth = totalSpaceToDistribute / (words.length - 1);

  return {
    words: words,
    spaceWidth: spaceWidth,
    isLastLine: false,
  };
};

// Helper function to estimate the height of a paper section
const estimatePaperHeight = (paper, font, boldFont, maxWidth) => {
  let height = 0;

  // Title
  const titleLines = splitTextToFit(paper.title, maxWidth, 14, boldFont);
  height += titleLines.length * 20 + 20;

  // Authors
  for (const author of paper.authors) {
    height += 15; // Name
    height += 15; // Affiliation
    height += 15; // Country
    if (author.email) height += 15; // Email
    height += 10; // Gap between authors
  }
  height += 20; // Gap before abstract

  // Abstract - allow for more space to be safe
  height += 20; // Abstract heading
  const abstractWords = paper.abstract.split(/\s+/).length;
  const estimatedLines = Math.ceil(abstractWords / 10); // Rough estimate
  height += estimatedLines * 15 + 40; // Line height + extra padding

  return height;
};

export default router;
