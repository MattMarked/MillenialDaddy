/**
 * Admin validation utilities for MillenialDaddy
 * 
 * This module handles validation of admin users based on their Instagram usernames.
 * Admin usernames are stored in environment variables for easy updates.
 */

/**
 * Check if a username is in the admin whitelist
 * @param {string} username - Instagram username to check
 * @returns {boolean} - True if username is an admin, false otherwise
 */
export function isAdmin(username) {
  if (!username) return false;
  
  // Get admin usernames from environment variable
  const adminUsernames = process.env.ADMIN_USERNAMES || '';
  
  // Convert to lowercase and split by comma
  const admins = adminUsernames.toLowerCase().split(',').map(name => name.trim());
  
  // Check if the provided username is in the admin list
  return admins.includes(username.toLowerCase());
}

/**
 * Get the list of admin usernames
 * @returns {string[]} - Array of admin usernames
 */
export function getAdminList() {
  const adminUsernames = process.env.ADMIN_USERNAMES || '';
  return adminUsernames.split(',').map(name => name.trim()).filter(Boolean);
}

/**
 * Validate admin configuration
 * @returns {boolean} - True if admin configuration is valid
 */
export function validateAdminConfig() {
  const admins = getAdminList();
  return admins.length > 0;
}
