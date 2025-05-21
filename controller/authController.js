import { comparePassword, hashPassword } from "../utils_helpers/authHelper.js";
import userModel from "../model/userModel.js";
// import conferenceModel from "../model/conferenceModel.js";
import JWT from "jsonwebtoken";
import userConferenceModel from "../model/userConferenceModel.js";
import bcrypt from "bcrypt"

export const registerController = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      recovery_key,
      expertise,
      conferenceId,
      role,
    } = req.body;

    // Validations
    if (!name) return res.send({ message: "Name is required" });
    if (!email) return res.send({ message: "Email is required" });
    if (!password) return res.send({ message: "Password is required" });
    if (!phone) return res.send({ message: "Phone is required" });
    if (!address) return res.send({ message: "Address is required" });
    if (!recovery_key) return res.send({ message: "Recovery Key is required" });

    let user = await userModel.findOne({ email });

    if (user) {
      // Handle already registered users and update UserConference if necessary
      if (role === "reviewer" && expertise && conferenceId) {
        let userConference = await userConferenceModel.findOne({
          userId: user._id,
        });

        if (!userConference) {
          userConference = new userConferenceModel({
            userId: user._id,
            roles: [
              {
                role: "reviewer",
                conferences: [conferenceId],
                expertise,
              },
            ],
          });
        } else {
          const reviewerRole = userConference.roles.find(
            (r) => r.role === "reviewer"
          );

          if (reviewerRole) {
            if (!reviewerRole.conferences.includes(conferenceId)) {
              reviewerRole.conferences.push(conferenceId);
            }
          } else {
            userConference.roles.push({
              role: "reviewer",
              conferences: [conferenceId],
              expertise,
            });
          }
        }

        await userConference.save();
      }

      return res.status(200).send({
        success: true,
        message: "User already registered, updated roles and conferences",
        user,
      });
    }

    // If user is new, hash the password and save
    const hashedPassword = await bcrypt.hash(password, 10);

    user = new userModel({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      recovery_key,
    });

    const savedUser = await user.save();

    // Create UserConference for new users if applicable
    if (role === "reviewer" && expertise && conferenceId) {
      const userConference = new userConferenceModel({
        userId: savedUser._id,
        roles: [
          {
            role: "reviewer",
            conferences: [conferenceId],
            expertise,
          },
        ],
      });

      await userConference.save();
    }

    res.status(201).send({
      success: true,
      message: "User registered successfully",
      user: savedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error registering user",
    });
  }
};
// login
export const loginController = async (req, res) => {
  try {
    const { email, password, role, conferenceId } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).send({
        success: false,
        message: "Email and password are required",
      });
    }

    // Check user
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "Email is not registered",
      });
    }

    if (role === "reviewer" && conferenceId) {
      let userConference = await userConferenceModel.findOne({
        userId: user._id,
      });

      if (!userConference) {
        userConference = new userConferenceModel({
          userId: user._id,
          roles: [
            {
              role: "reviewer",
              conferences: [conferenceId],
            },
          ],
        });
      } else {
        const reviewerRole = userConference.roles.find(
          (r) => r.role === "reviewer"
        );

        if (reviewerRole) {
          if (!reviewerRole.conferences.includes(conferenceId)) {
            reviewerRole.conferences.push(conferenceId);
          }
        } else {
          userConference.roles.push({
            role: "reviewer",
            conferences: [conferenceId],
          });
        }
      }

      await userConference.save();
    }

    // Check password match
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(200).send({
        success: false,
        message: "Password not matched",
      });
    }

    // Generate token
    const token = await JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(200).send({
      success: true,
      message: "Logged in successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        phone: user.phone,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      message: "Error in Login",
      error: error.message,
    });
  }
};

//forgotPasswordController

export const forgotPasswordController = async (req, res) => {
  try {
    const { email, recovery_key, newPassword } = req.body;
    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }
    if (!recovery_key) {
      return res.status(400).send({ message: "Answer is required" });
    }
    if (!newPassword) {
      return res.status(400).send({ message: "New Password is required" });
    }
    //check
    const user = await userModel.findOne({ email, recovery_key });
    //validation
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "Wrong Email Or Answer",
      });
    }
    const hashed = await hashPassword(newPassword);
    await userModel.findByIdAndUpdate(user._id, { password: hashed });
    res.status(200).send({
      success: true,
      message: "Password Reset Successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Something went wrong",
      error,
    });
  }
};

//update profile
export const updateProfileController = async (req, res) => {
  try {
    const { name, email, password, address, phone } = req.body;
    const user = await userModel.findById(req.user._id);
    //password
    if (password && password.length < 6) {
      return res.json({ error: "Passsword is required and 6 character long" });
    }
    const hashedPassword = password ? await hashPassword(password) : undefined;
    const updatedUser = await userModel.findByIdAndUpdate(
      req.user._id,
      {
        name: name || user.name,
        password: hashedPassword || user.password,
        phone: phone || user.phone,
        address: address || user.address,
      },
      { new: true }
    );
    res.status(200).send({
      success: true,
      message: "Profile Updated SUccessfully",
      updatedUser,
    });
  } catch (error) {
    res.status(400).send({
      success: false,
      message: "Error WHile Update profile",
      error,
    });
  }
};
export const getUserRolesController = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user roles along with conferences
    const userConferences = await userConferenceModel
      .findOne({ userId })
      .populate({
        path: "roles.conferences",
        select: "conferenceName acronym status", // Select only necessary fields
        match: { status: "approved" }, // Filter only approved conferences
      })
      .exec();

    // If no data is found, return an empty roles array
    if (!userConferences || userConferences.roles.length === 0) {
      return res.status(200).json({ roles: [] });
    }

    // Extract and format roles with conferences
    const roles = userConferences.roles.flatMap((roleEntry) => {
      // Map through conferences for the role
      return roleEntry.conferences
        .filter((conf) => conf !== null) // Exclude null conferences
        .map((conference) => ({
          conferenceId: conference._id,
          conferenceName: conference.conferenceName,
          acronym: conference.acronym,
          status: conference.status,
          role: roleEntry.role,
          expertise:
            roleEntry.role === "reviewer" ? roleEntry.expertise : undefined, // Include expertise if role is 'reviewer'
        }));
    });

    res.status(200).json({ roles });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    res.status(500).json({ message: "Error fetching roles", error });
  }
};

export const getUserConferencesByRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query; // Get the role from the query parameters

    if (!role) {
      a;
      return res.status(400).json({ message: "Role parameter is required" });
    }

    // Fetch user's roles and associated conferences
    const userConferences = await userConferenceModel
      .findOne({ userId })
      .populate({
        path: "roles.conferences",
        select: "conferenceName acronym status", // Select only necessary fields
        match: { status: "approved" }, // Filter only approved conferences
      })
      .exec();

    // If no data is found, return an empty array
    if (!userConferences || userConferences.roles.length === 0) {
      return res.status(200).json({ conferences: [] });
    }

    // Filter and format conferences based on the specified role
    const conferences = userConferences.roles
      .filter((roleEntry) => roleEntry.role === role) // Filter by the given role
      .flatMap((roleEntry) =>
        roleEntry.conferences
          .filter((conf) => conf !== null) // Exclude null conferences
          .map((conference) => ({
            conferenceId: conference._id,
            conferenceName: conference.conferenceName,
            acronym: conference.acronym,
            status: conference.status,
          }))
      );

    res.status(200).json({ conferences });
  } catch (error) {
    console.error("Error fetching conferences by role:", error);
    res.status(500).json({ message: "Error fetching conferences", error });
  }
};
