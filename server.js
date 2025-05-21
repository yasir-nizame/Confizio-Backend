import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoute.js";
import authorRoute from "./routes/authorRoute.js";
import conferenceRoute from "./routes/conferenceRoute.js";
import emailRoute from "./routes/emailRoute.js";
import reviewerRoute from "./routes/reviewerRoute.js";
import organizerRoute from "./routes/organizerRoute.js";
import path from "path";
import cors from "cors";

dotenv.config();
connectDB();

const app = express();
const port = process.env.PORT;

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/author", authorRoute);
app.use("/api/conference", conferenceRoute);
app.use("/api/organizer", organizerRoute);
app.use("/api/email", emailRoute);
app.use("/api/reviewer", reviewerRoute);

// Handle unknown API routes properly
app.all("/api/*", (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

// Serve React frontend
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "/frontend/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/frontend/build/index.html"));
});

// Start Server
app.listen(port, () => {
  console.log(`App listening on port: ${port}`);
});
