import InvitationModel from "../model/InvitationModel.js";
import { createTransporter } from "../config/nodemailer.js";
import dotenv from "dotenv";
dotenv.config();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const sendInvitationController = async (req, res) => {
  const { reviewerEmails, conferenceId, conferenceName, additionalMessage } =
    req.body;

  try {
    // Validate input
    if (!reviewerEmails || reviewerEmails.length === 0) {
      return res.status(400).json({ message: "No emails provided." });
    }

    // Initialize the transporter
    const transporter = createTransporter;

    // Prepare and send email invitations
    const emailPromises = reviewerEmails.map(async (email) => {
      if (!isValidEmail(email)) {
        return Promise.reject(new Error(`Invalid email address: ${email}`));
      }
      // http://localhost:3000
      const inviteLink = `/response?role=reviewer&conferenceId=${conferenceId}&conferenceName=${encodeURIComponent(
        conferenceName
      )}`;

      // Create the invitation entry in the database
      await InvitationModel.create({ email, conferenceId });

      // Send the email
      return transporter.sendMail({
        from: process.env.EMAIL,
        to: email,
        subject: "Reviewer Invitation",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2 style="color: #333;">Invitation to Review for ${conferenceName}</h2>
            <p>You have been invited to join as a reviewer for the <strong>${conferenceName}</strong>.</p>
            ${additionalMessage ? `<p>${additionalMessage}</p>` : ""}
            <p>Click the link below to respond to the invitation:</p>
            <a href="${inviteLink}" style="display: inline-block; margin-top: 10px; padding: 5px 10px; color: white; background-color: #4B5641; border-radius: 5px; text-decoration: none;">Respond to Invitation</a>
            <p style="margin-top: 20px;">Thank you,<br>The ${conferenceName} Team</p>
          </div>
        `,
      });
    });

    await Promise.all(emailPromises);

    res.status(200).json({ message: "Invitations sent successfully!" });
  } catch (error) {
    console.error("Error sending invitations:", error);
    res.status(500).json({
      message: "Error sending invitations.",
      error: error.message,
    });
  }
};
