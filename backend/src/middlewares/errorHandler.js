export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Không tìm thấy route: ${req.originalUrl}`));
}

export function errorHandler(error, req, res, next) {
  const statusCode =
    error.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  const payload = {
    success: false,
    message: error.message || "Server error",
  };

  if (error.cooldownRemainingSeconds !== undefined) {
    payload.cooldownRemainingSeconds =
      Number(error.cooldownRemainingSeconds) || 0;
  }

  if (error.cooldownAvailableAt) {
    payload.cooldownAvailableAt = error.cooldownAvailableAt;
  }

  res.status(statusCode).json(payload);
}
