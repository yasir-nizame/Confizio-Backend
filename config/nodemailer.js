import nodemailer from "nodemailer";
import { google } from "googleapis";
import dotenv from "dotenv";

// *Useful for getting environment vairables
dotenv.config();
// const oAuth2Client = new google.auth.OAuth2(
//   process.env.CLIENT_ID,
//   process.env.CLIENT_SECRET,
//   process.env.REDIRECT_URI
// );

// oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
// export const createTransporter = async () => {
//   const accessToken = await oAuth2Client.getAccessToken();
//   if (!accessToken.token) {
//     throw new Error("Failed to generate access token.");
//   }

//   return nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       type: "OAuth2",
//       user: process.env.EMAIL,
//       clientId: process.env.CLIENT_ID,
//       clientSecret: process.env.CLIENT_SECRET,
//       refreshToken: process.env.REFRESH_TOKEN,
//       accessToken: accessToken.token,
//       access_type: "offline",
//     },
//   });
// };

// import nodemailer from "nodemailer";
// import { google } from "googleapis";
// import dotenv from "dotenv";

// // * Load environment variables
// dotenv.config();

// const oAuth2Client = new google.auth.OAuth2(
//   process.env.CLIENT_ID,
//   process.env.CLIENT_SECRET,
//   process.env.REDIRECT_URI
// );

// oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

// export const createTransporter = async () => {
//   try {
//     const accessToken = await oAuth2Client.getAccessToken();

//     if (!accessToken || !accessToken.token) {
//       throw new Error("Failed to generate access token.");
//     }

//     return nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         type: "OAuth2",
//         user: process.env.EMAIL,
//         clientId: process.env.CLIENT_ID,
//         clientSecret: process.env.CLIENT_SECRET,
//         refreshToken: process.env.REFRESH_TOKEN,
//         accessToken: accessToken.token,
//       },
//     });
//   } catch (error) {
//     console.error("Error creating transporter:", error.message);
//     throw error;
//   }
// };

export const createTransporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.GMAIL_USER, // Use environment variable for email
    pass: process.env.GMAIL_PASSWORD, // Use environment variable for password
  },
});
