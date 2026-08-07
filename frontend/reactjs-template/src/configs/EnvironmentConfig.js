// REACT_APP_API_BASE_URL is the single explicit override mechanism.
// Set it in .env.local (never commit real credentials) to direct the frontend
// at a specific API — for example http://localhost:3002 for local Nest validation.
//
// When the variable is absent, NODE_ENV-specific fallbacks are used exactly as
// they were before Phase 8A.  Do not point production at Nest via this file.
const dev = {
  API_ENDPOINT_URL: 'http://localhost:3000',
};

const prod = {
  API_ENDPOINT_URL: 'https://api.prod.com',
};

const test = {
  API_ENDPOINT_URL: 'https://api.test.com',
};

const getEnv = () => {
  if (process.env.REACT_APP_API_BASE_URL) {
    return { API_ENDPOINT_URL: process.env.REACT_APP_API_BASE_URL };
  }
  switch (process.env.NODE_ENV) {
    case 'production':
      return prod;
    case 'test':
      return test;
    case 'development':
    default:
      return dev;
  }
};

export const env = getEnv();
