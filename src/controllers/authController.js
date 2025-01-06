const prisma = require("../utils/db");

exports.googleCallback = async (req, res) => {
  try {
    const { id, displayName, emails, photos } = req.user;

    // Extract relevant details
    const email = emails[0]?.value;
    const profilePicture = photos[0]?.value;

    // Check if the user exists in the database
    let user = await prisma.user.findUnique({
      where: { googleId: id },
    });

    // If user doesn't exist, create a new user
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: id,
          email,
          name: displayName,
          profilePicture,
          password: "Tamil@9976",
          address : "none"
        },
      });
    }

    // Store user in session
    req.session.user = user;

    // Redirect to the profile page or any other desired route
    res.json({message : "Success"});
  } catch (error) {
    console.error("Error in Google callback:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
