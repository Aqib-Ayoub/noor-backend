import { Response } from 'express';

/**
 * Sends a standardized success JSON response.
 * @param res - Express response object
 * @param data - Payload to send (any serializable object)
 * @param message - Human-readable success message
 * @param statusCode - HTTP status code (default: 200)
 */
export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'Success',
  statusCode = 200
): Response => {
  return res.status(statusCode).json({ success: true, message, data });
};

/**
 * Sends a standardized error JSON response.
 * @param res - Express response object
 * @param message - Human-readable error message
 * @param statusCode - HTTP status code (default: 400)
 * @param errors - Optional array of field-level validation errors
 */
export const sendError = (
  res: Response,
  message = 'An error occurred',
  statusCode = 400,
  errors?: unknown
): Response => {
  return res.status(statusCode).json({ success: false, message, errors });
};
