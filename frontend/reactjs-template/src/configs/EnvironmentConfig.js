// Keep the existing local legacy backend as the safe default until production cutover.
// Set REACT_APP_API_BASE_URL=http://localhost:3002 to run the frontend against Nest.
export const env = {
  API_ENDPOINT_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000',
}
