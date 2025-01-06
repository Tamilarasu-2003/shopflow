const validateSearchQuery = (req, res, next) => {
  const { query } = req.query;

  if (!query || query.trim().length === 0) {
    return res
      .status(400)
      .send({ success: false, error: "Search query is required." });
  }

  next();
};

module.exports = { validateSearchQuery };
