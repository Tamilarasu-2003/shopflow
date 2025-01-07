
exports.sendResponse = (res, options = {}) => {
    const { 
        status = 200,
        type = 'success',
        message = '',
        data = null,
        error = null,
        validationErrors = null 
    } = options;

    const response = {
        status: type,
        message,
    };

    if (data) response.data = data;
    if (error) response.error = error;
    if (validationErrors) response.validationErrors = validationErrors;

    res.status(status).json(response);
};
