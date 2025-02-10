exports.sendResponse = (res, options = {}) => {
  try {
    const {
      status = 200,
      type = "success",
      message = "",
      data = null,
      error = null,
      validationErrors = null,
      totalPages = null,
      token = null,
      totalAmount = null,
    } = options;

    const response = {
      status: type,
      message,
    };

    if (data) response.data = data;
    if (totalPages) response.totalPages = totalPages;
    if (totalAmount) response.totalAmount = totalAmount;
    if (token) response.token = token;
    if (error) response.error = error;
    if (validationErrors) response.validationErrors = validationErrors;

    res.status(status).json(response);

  } catch (error) {
    console.error(error.message);
  }
};
