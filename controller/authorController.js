import ResearchPaper from "../model/researchPaperModel.js";
import supabase from "../config/supabase.js";
import Author from "../model/authorModel.js";
import userConference from "../model/userConferenceModel.js";
import conferenceModel from "../model/conferenceModel.js";
import pdfParse from "pdf-parse";
import { fileURLToPath } from "url";
import axios from "axios";
import path from "path";
import { spawn } from "child_process"; // For running Python script
// Derive __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import which from "which";

const getPythonCommand = () => {
  const venvPythonPath = path.join(__dirname, "venv/bin/python");

  // 1. If virtual env python exists, use that
  if (fs.existsSync(venvPythonPath)) {
    return venvPythonPath;
  }

  // 2. Otherwise, try to find 'python3'
  try {
    return which.sync("python3");
  } catch {
    // 3. Fallback to 'python'
    return which.sync("python");
  }
};

export const checkComplianceController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "PDF file is required." });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res
        .status(400)
        .json({ message: "Invalid file type. Only PDF files are allowed." });
    }

    // Run the compliance check
    const complianceReport = await runPythonChecker(req.file.buffer);

    return res.status(200).json({
      message: "Compliance check completed",
      complianceReport,
    });
  } catch (error) {
    console.error("Compliance check error:", error.message);
    return res.status(500).json({
      message: "Error performing compliance check",
      error: error.message,
    });
  }
};

export const checkPlagiarismController = async (pdfBuffer, paperId) => {
  try {
    const pdfData = await pdfParse(pdfBuffer);
    const textContent = pdfData.text;

    if (!textContent || textContent.trim().length === 0) {
      throw new Error("No text could be extracted from the PDF.");
    }

    const url = "https://api.edenai.run/v2/text/ai_detection/";
    const response = await axios.post(
      url,
      {
        response_as_dict: true,
        attributes_as_list: false,
        show_base_64: true,
        show_original_response: false,
        providers: "sapling,winstonai",
        text: textContent.substring(0, 10000),
      },
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNDI3NGJkM2UtOTdlNS00NTI4LTgzNDYtOTQ2NGYwYjg5YjYxIiwidHlwZSI6ImFwaV90b2tlbiJ9.LA4OM8ngGkCRKzyBgy4sjPKPjshJEmQkr175U4mFjns",
        },
      }
    );

    const json = response.data;
    console.log("reponse form api of eden ", json);

    const winstonResult = json.winstonai;
    const saplingResult = json.sapling;
    console.log("winstonai api response: ", winstonResult);
    console.log("sapling api response is: ", saplingResult);

    if (!winstonResult) {
      throw new Error("No plagiarism data returned from winston API.");
    }
    if (!saplingResult) {
      throw new Error("No plagiarism data returned from sapling API.");
    }

    const plagiarismReport = {
      score: winstonResult.score || 0,
      isAIGenerated: winstonResult.ai_score > 0.5,
      details: [
        {
          type: "Plagiarism Score",
          value: winstonResult.score || 0,
          description: `The paper has a ${winstonResult.score}% likelihood of containing plagiarized content.`,
        },
        {
          type: "AI Content",
          value: winstonResult.ai_score || 0,
          description: `The paper has a ${
            winstonResult.ai_score * 100
          }% likelihood of being AI-generated.`,
        },
      ],
    };

    await ResearchPaper.findByIdAndUpdate(
      paperId,
      { plagiarismReport },
      { new: true }
    );

    return plagiarismReport;
  } catch (error) {
    console.error("Plagiarism check error:", error.message);

    const failedReport = {
      score: 0,
      isAIGenerated: false,
      details: [
        {
          type: "Error",
          value: 0,
          description: `Plagiarism check failed: ${error.message}`,
        },
      ],
    };

    await ResearchPaper.findByIdAndUpdate(
      paperId,
      { plagiarismReport: failedReport },
      { new: true }
    );

    throw error;
  }
};

// dummy controller with random values tb deleted  later
export const dummyPlagiarismCheckController = async (pdfBuffer, paperId) => {
  try {
    const pdfData = await pdfParse(pdfBuffer);
    const textContent = pdfData.text;

    if (!textContent || textContent.trim().length === 0) {
      throw new Error("No text could be extracted from the PDF.");
    }

    // Dummy scores for testing frontend
    const randomScore = Math.floor(Math.random() * 100); // 0 to 99
    const randomAiScore = (Math.random() * 100).toFixed(2); // 0.0 to 1.0

    const plagiarismReport = {
      score: randomScore,
      isAIGenerated: randomAiScore > 0.5,
      details: [
        {
          type: "Plagiarism Score",
          value: randomScore,
          description: `The paper has a ${randomScore}% likelihood of containing plagiarized content.`,
        },
        {
          type: "AI Content",
          value: randomAiScore,
          description: `The paper has a ${randomAiScore}% likelihood of being AI-generated.`,
        },
      ],
    };

    await ResearchPaper.findByIdAndUpdate(
      paperId,
      { plagiarismReport },
      { new: true }
    );

    return plagiarismReport;
  } catch (error) {
    console.error("Dummy plagiarism check error:", error.message);

    const failedReport = {
      score: 0,
      isAIGenerated: false,
      details: [
        {
          type: "Error",
          value: 0,
          description: `Dummy plagiarism check failed: ${error.message}`,
        },
      ],
    };

    await ResearchPaper.findByIdAndUpdate(
      paperId,
      { plagiarismReport: failedReport },
      { new: true }
    );

    throw error;
  }
};

export const submitPaperController = async (req, res) => {
  try {
    const {
      title,
      abstract,
      keywords,
      conferenceName,
      conferenceAcronym,
      userId,
      conferenceId,
    } = req.body;
    let { authors } = req.body;

    // Step 1: Validate input data (unchanged)
    if (!userId)
      return res.status(400).json({ message: "User ID is required." });
    if (!conferenceId)
      return res.status(400).json({ message: "Conference ID is required." });
    if (!title || !abstract || !keywords || !conferenceAcronym) {
      return res
        .status(400)
        .json({ message: "All paper details are required." });
    }

    if (typeof authors === "string") {
      try {
        authors = JSON.parse(authors);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid authors JSON format." });
      }
    }

    const conference = await conferenceModel.findById(conferenceId);
    if (!conference)
      return res.status(404).json({ message: "Conference not found." });

    const existingPaper = await ResearchPaper.findOne({ title, conferenceId });
    if (existingPaper) {
      return res.status(400).json({
        message: "A paper with this title already exists for this conference.",
      });
    }

    if (!req.file)
      return res.status(400).json({ message: "File upload is required." });
    const allowedTypes = ["application/pdf"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ message: "Invalid file type. Only PDF files are allowed." });
    }

    // Step 2: Upload the file to Supabase (unchanged)
    const fileName = `${Date.now()}_${req.file.originalname}`;
    const { data, error } = await supabase.storage
      .from("paper-submissions")
      .upload(fileName, req.file.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: req.file.mimetype,
      });

    if (error) {
      console.error(`Supabase upload error: ${error.message}`);
      return res
        .status(500)
        .json({ message: `Supabase upload error: ${error.message}` });
    }

    const filePath = `https://xdfqydvtgxcnmiylydvk.supabase.co/storage/v1/object/public/paper-submissions/${data.path}`;

    if (!authors || !Array.isArray(authors) || !authors.length) {
      return res
        .status(400)
        .json({ message: "At least one author is required." });
    }

    const validAuthor = authors.find(
      (author) => author.firstName && author.email
    );
    if (!validAuthor) {
      return res.status(400).json({
        message: "At least one author must have firstName and email filled.",
      });
    }

    // Step 3: Handle userConference (unchanged)
    let userConferenceRecord = await userConference.findOne({ userId });
    if (!userConferenceRecord) {
      userConferenceRecord = await userConference.create({
        userId,
        roles: [{ role: "author", conferences: [conference._id] }],
      });
    } else {
      const authorRole = userConferenceRecord.roles.find(
        (role) => role.role === "author"
      );
      if (authorRole) {
        if (!authorRole.conferences.includes(conference._id)) {
          authorRole.conferences.push(conference._id);
          await userConferenceRecord.save();
        }
      } else {
        userConferenceRecord.roles.push({
          role: "author",
          conferences: [conference._id],
        });
        await userConferenceRecord.save();
      }
    }

    // Step 4: Save authors with userConferenceId (unchanged)
    const userConferenceId = userConferenceRecord._id;
    const authorIds = await Promise.all(
      authors.map(async (authorData) => {
        let existingAuthor = await Author.findOne({ email: authorData.email });
        if (!existingAuthor) {
          existingAuthor = new Author({ ...authorData, userConferenceId });
          await existingAuthor.save();
        } else if (!existingAuthor.userConferenceId) {
          existingAuthor.userConferenceId = userConferenceId;
          await existingAuthor.save();
        }
        return existingAuthor._id;
      })
    );

    // Step 5: Save paper (unchanged)
    const paper = new ResearchPaper({
      title,
      abstract,
      keywords: keywords.split(",").map((kw) => kw.trim()),
      authors: authorIds,
      paperFilePath: filePath,
      conferenceName,
      conferenceAcronym,
      conferenceId,
    });

    await paper.save();

    await conferenceModel.findByIdAndUpdate(
      conference._id,
      { $push: { papers: paper._id } },
      { new: true }
    );

    // Step 6: Run compliance check asynchronously
    let complianceReport = {
      percentage: 0,
      details: [
        {
          rule: "Pending",
          passed: false,
          message: "Compliance check is running...",
          suggestion:
            "Please wait a few seconds for the compliance check to complete.",
        },
      ],
    };

    runPythonChecker(req.file.buffer)
      .then((report) => {
        return ResearchPaper.findByIdAndUpdate(
          paper._id,
          { complianceReport: report },
          { new: true }
        );
      })
      .catch((error) => {
        console.error("Failed to save compliance report:", error.message);
        const failedReport = {
          percentage: 0,
          details: [
            { rule: "Python Execution", passed: false, message: error.message },
          ],
        };
        return ResearchPaper.findByIdAndUpdate(
          paper._id,
          { complianceReport: failedReport },
          { new: true }
        );
      })
      .catch((err) =>
        console.error("Failed to save failed compliance report:", err.message)
      );

    //////////////////added code  for plag////////////////////

    // Step 7: Run plagiarism check asynchronously
    let plagiarismReport = {
      score: 0,
      isAIGenerated: false,
      details: [
        {
          type: "Pending",
          value: 0,
          description: "Plagiarism check is running...",
        },
      ],
    };

    //replace back with originial controler
    dummyPlagiarismCheckController(req.file.buffer, paper._id)
      .then((report) => {
        // console.log("Plagiarism Report:", report);
        // Plagiarism report is already saved in the controller
      })
      .catch((error) => {
        console.error("Failed to process plagiarism check:", error.message);
        // Error report is already saved in the controller
      });

    return res.status(201).json({
      message: "Paper submitted successfully",
      paper,
      complianceReport,
      plagiarismReport,
    });

    // return res.status(201).json({
    //   message: "Paper submitted successfully",
    //   paper,
    //   complianceReport,
    // });
  } catch (error) {
    console.error("Submission error:", error.message);
    return res
      .status(500)
      .json({ message: "Error submitting paper", error: error.message });
  }
};

// Function to run Python script
const runPythonChecker = (pdfBuffer) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "../scripts/ieee_checker.py");

    const pythonCommand = getPythonCommand();

    console.log("pythonCommand", pythonCommand);
    const pythonProcess = spawn(pythonCommand, [scriptPath]);
    let output = "";
    let errorOutput = "";

    // Send PDF buffer to Python script via stdin
    pythonProcess.stdin.write(pdfBuffer);
    pythonProcess.stdin.end();

    // Capture stdout (compliance report)
    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
      // console.log("Python stdout:", data.toString()); // Debug output
    });

    // Capture stderr (errors)
    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      // console.log("Python stderr:", data.toString()); // Debug errors
    });

    // Handle process completion
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          // Filter out non-JSON debug lines and parse the last JSON object
          const lines = output.split("\n");
          const jsonLine = lines
            .reverse()
            .find((line) => line.trim().startsWith("{"));
          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            resolve(result);
          } else {
            reject(new Error("No valid JSON output from Python script"));
          }
        } catch (parseError) {
          reject(
            new Error(
              `Failed to parse Python output: ${parseError.message}, Output: ${output}`
            )
          );
        }
      } else {
        reject(
          new Error(`Python script failed with code ${code}: ${errorOutput}`)
        );
      }
    });

    // Handle spawn errors
    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
};

// Get Research Paper by ID Controller
export const getResearchPaperByIdController = async (req, res) => {
  try {
    const { id } = req.params; // Extract paper ID from request params
    const paper = await ResearchPaper.findById(id)
      .populate("authors", " firstName lastName email")
      .populate("conferenceId", "name acronym");

    if (!paper) {
      return res.status(404).json({ message: "Research paper not found." });
    }

    res.status(200).json({
      message: "Research paper details fetched successfully.",
      data: paper,
    });
  } catch (error) {
    console.error("Error fetching research paper details:", error);
    res.status(500).json({
      message: "Error fetching research paper details.",
      error: error.message,
    });
  }
};

// Get All Research Papers Controller
export const getAllResearchPapersController = async (req, res) => {
  try {
    // Fetch all research papers from the database and populate author details
    const researchPapers = await ResearchPaper.find().populate("authors");

    // Check if there are any research papers
    if (researchPapers.length === 0) {
      return res.status(404).json({ message: "No research papers found." });
    }

    res.status(200).json(researchPapers);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error retrieving research papers", error });
  }
};
export const getUserConferencePapersController = async (req, res) => {
  try {
    const { userId, conferenceId } = req.params;

    // Step 1: Validate input
    if (!userId || !conferenceId) {
      return res
        .status(400)
        .json({ message: "User ID and Conference ID are required." });
    }

    // Step 2: Find the user's author record linked to the userConference model
    const userConferenceRecord = await userConference
      .findOne({ userId })
      .populate("roles.conferences")
      .exec();

    if (!userConferenceRecord) {
      return res
        .status(404)
        .json({ message: "User not found in the conference system." });
    }

    // Step 3: Find the author's ID using the userConference reference
    const author = await Author.findOne({
      userConferenceId: userConferenceRecord._id,
    });

    if (!author) {
      return res
        .status(404)
        .json({ message: "Author record not found for the user." });
    }

    // Step 4: Fetch all papers for the given conference authored by this user
    const papers = await ResearchPaper.find({
      conferenceId,
      authors: author._id,
    })
      .populate({
        path: "authors",
        select:
          "firstName lastName email country affiliation correspondingAuthor",
      })
      .populate({
        path: "reviews",
        populate: {
          path: "reviewerId",
          select: "name email",
        },
      });

    if (papers.length === 0) {
      return res.status(404).json({
        message: "No papers found for the user in the specified conference.",
      });
    }

    // Step 5: Respond with the fetched papers
    return res.status(200).json({ papers });
  } catch (error) {
    console.error("Error fetching user's papers:", error);
    return res.status(500).json({
      message: "An error occurred while fetching papers.",
      error: error.message,
    });
  }
};

export const updatePaperController = async (req, res) => {
  try {
    const paperId = req.params.id;
    const { userId, title, abstract, keywords, authors, isResubmit } = req.body;
    const file = req.file; // From multer middleware

    // Step 1: Validate input data
    if (!paperId) {
      return res.status(400).json({ message: "Paper ID is required." });
    }

    // Step 2: Check if paper exists
    const existingPaper = await ResearchPaper.findById(paperId);
    if (!existingPaper) {
      return res.status(404).json({ message: "Paper not found." });
    }

    // Step 3: Prepare update object for changed fields
    const updates = {};

    // ✅ Update status to "resubmitted" if flagged
    if (isResubmit === true || isResubmit === "true") {
      updates.status = "resubmitted";
      updates.finaldecision = "pending";
    }

    // Handle title
    if (title) {
      updates.title = title;
    }

    // Handle abstract
    if (abstract) {
      updates.abstract = abstract;
    }

    // Handle keywords
    if (keywords) {
      updates.keywords = keywords.split(",").map((kw) => kw.trim());
    }

    // Step 4: Handle file upload to Supabase (if provided)
    if (file) {
      const allowedTypes = ["application/pdf"];
      if (!allowedTypes.includes(file.mimetype)) {
        return res
          .status(400)
          .json({ message: "Invalid file type. Only PDF files are allowed." });
      }

      // Delete the old file from Supabase if it exists
      if (existingPaper.paperFilePath) {
        const oldFilePath = existingPaper.paperFilePath.split("/").pop(); // Extract file name from URL
        const { error: deleteError } = await supabase.storage
          .from("paper-submissions")
          .remove([oldFilePath]);

        if (deleteError) {
          console.error(`Supabase delete error: ${deleteError.message}`);
          // Log the error but continue with the upload (optional: fail the request)
        }
      }

      // Upload the new file
      const fileName = `${Date.now()}_${file.originalname}`;
      const { data, error } = await supabase.storage
        .from("paper-submissions")
        .upload(fileName, file.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.mimetype,
        });

      if (error) {
        console.error(`Supabase upload error: ${error.message}`);
        return res
          .status(500)
          .json({ message: `Supabase upload error: ${error.message}` });
      }

      updates.paperFilePath = `https://xdfqydvtgxcnmiylydvk.supabase.co/storage/v1/object/public/paper-submissions/${fileName}`;
    }

    // Step 6: Apply updates to the paper
    if (Object.keys(updates).length > 0) {
      Object.assign(existingPaper, updates);
      await existingPaper.save();
    } else {
      return res.status(200).json({ message: "No changes detected." });
    }

    // Step 7: Respond with success
    res.status(200).json({
      message: "Paper updated successfully",
      paper: existingPaper,
    });
  } catch (error) {
    console.error("Update Paper Error:", error);
    res
      .status(500)
      .json({ message: "Error updating paper", error: error.message });
  }
};

export const deletePaperController = async (req, res) => {
  try {
    const { id, conferenceId } = req.params;

    // Step 1: Find the paper by ID
    const paper = await ResearchPaper.findById(id).populate("authors");
    if (!paper) {
      return res.status(404).json({ message: "Paper not found" });
    }

    // Step 2: Delete the file from Supabase
    const filePath = paper.paperFilePath;
    if (filePath) {
      const fileName = filePath.split("/").pop();
      const { error } = await supabase.storage
        .from("paper-submissions")
        .remove([fileName]);

      if (error) {
        console.error(`Supabase delete error: ${error.message}`);
        // Log error but continue (optional: fail the request)
      }
    }

    // Step 3: Handle author associations
    if (paper.authors && paper.authors.length > 0) {
      for (const author of paper.authors) {
        if (!author.userConferenceId) {
          console.error(
            "Author userConferenceId is missing for author:",
            author
          );
          continue;
        }

        // Step 3.1: Remove conferenceId from the UserConference record
        const updatedUserConference = await userConference.findOneAndUpdate(
          { _id: author.userConferenceId, "roles.role": "author" },
          { $pull: { "roles.$.conferences": conferenceId } },
          { new: true }
        );

        if (!updatedUserConference) {
          console.error(
            `No UserConference found for userConferenceId: ${author.userConferenceId}`
          );
          continue;
        }

        // Step 3.2: Check if the author has any other papers in any conference
        const otherPapers = await ResearchPaper.find({
          authors: author._id,
          _id: { $ne: id }, // Exclude the current paper
        });

        // Step 3.3: If no other papers exist, remove the "author" role
        if (otherPapers.length === 0) {
          const authorRole = updatedUserConference.roles.find(
            (role) => role.role === "author"
          );

          if (authorRole && authorRole.conferences.length === 0) {
            await userConference.updateOne(
              { _id: author.userConferenceId },
              { $pull: { roles: { role: "author" } } }
            );
          }
        }
      }
    } else {
      console.warn("No authors found in the paper.");
    }

    // Step 4: Delete the paper record from MongoDB
    await ResearchPaper.findByIdAndDelete(id);

    // Step 5: Respond with success
    res.status(200).json({
      message: "Paper and associated data deleted successfully",
    });
  } catch (error) {
    console.error("Error in deletePaperController:", error);
    res.status(500).json({
      message: "Error deleting paper and associated data",
      error: error.message,
    });
  }
};
