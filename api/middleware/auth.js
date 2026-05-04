/**
 * API Key Authentication Middleware
 * Validates X-API-Key header against configured API keys
 */

const validateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      code: 'MISSING_API_KEY',
    });
  }

  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
    });
  }

  // Add API key to request for potential logging/auditing
  req.apiKey = apiKey;
  next();
};

module.exports = validateApiKey;
