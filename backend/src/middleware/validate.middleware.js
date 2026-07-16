const validateRequest = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) {
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION', message: 'Validation failed' },
      errors: result.error.flatten(),
    });
  }
  req[target] = result.data;
  return next();
};

module.exports = validateRequest;
