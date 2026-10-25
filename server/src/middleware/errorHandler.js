export function notFound(req, res) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }); }
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || (err.name === 'ZodError' ? 400 : err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500);
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(status).json({ error: { code: err.name === 'ZodError' ? 'VALIDATION_ERROR' : err.code || 'INTERNAL_ERROR', message: status === 500 ? 'Something went wrong.' : err.message, ...(err.details ? { details: err.details } : {}) } });
}
