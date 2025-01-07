const prisma = require("../utils/db");

exports.googleCallback = async (req, res) => {
  try {
    const { id, displayName, emails, photos } = req.user;

    const email = emails[0]?.value;
    const profilePicture = photos[0]?.value;

    let user = await prisma.user.findUnique({
      where: { googleId: id },
    });

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

    req.session.user = user;

    res.json({message : "Success"});
  } catch (error) {
    console.error("Error in Google callback:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
