/**
 * Custom signing hook for electron-builder
 * This hook allows us to bypass signing in development environments
 * without hitting the library's internal bugs or admin restrictions.
 */
exports.default = async function(configuration) {
  // Skip signing if explicit skip flag is set OR if we are NOT in a CI environment
  // You can adjust the CI condition based on your production build server (e.g., GH Actions, Jenkins)
  const shouldSkip = process.env.CSC_SKIP_SIGNING === 'true' || !process.env.CI;
  
  if (shouldSkip) {
    console.log('\n[SIGN-HOOK] Skipping code signing for the current environment.');
    return true;
  }

  // Returning false tells electron-builder to fall back to the default signing logic
  // which will use your production certificates if configured.
  return false;
};
