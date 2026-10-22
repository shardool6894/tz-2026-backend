const isLoopbackOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
};

const createCorsOptions = (env = process.env) => {
  const allowedOrigins = (env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const localDevelopment = env.NODE_ENV !== 'production' && !env.VERCEL;

  return {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)
        || (localDevelopment && isLoopbackOrigin(origin))) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  };
};

module.exports = { createCorsOptions };
