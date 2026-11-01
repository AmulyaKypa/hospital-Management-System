// Create an Error that the central error handler turns into a JSON response with this status
module.exports = (status, message) => Object.assign(new Error(message), { status });
