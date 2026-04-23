import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

/** Shape of the JWT payload used throughout Noor */
export interface NoorJwtPayload extends JwtPayload {
  userId: string;
  role: string;
}

/**
 * Service that handles all JWT operations — signing and verification.
 * Reads the secret and expiry duration from environment variables.
 */
export class JwtService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    this.secret = process.env.JWT_SECRET ?? 'fallback_secret';
    this.expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
  }

  /**
   * Signs a new JWT token containing user identity and role.
   * @param userId - MongoDB ObjectId string of the user
   * @param role - UserRole enum value
   * @returns Signed JWT string
   */
  sign(userId: string, role: string): string {
    const payload: NoorJwtPayload = { userId, role };
    const options: SignOptions = { expiresIn: this.expiresIn as SignOptions['expiresIn'] };
    return jwt.sign(payload, this.secret, options);
  }

  /**
   * Verifies and decodes a JWT token.
   * @param token - The raw JWT string from Authorization header
   * @returns Decoded NoorJwtPayload or null if invalid/expired
   */
  verify(token: string): NoorJwtPayload | null {
    try {
      return jwt.verify(token, this.secret) as NoorJwtPayload;
    } catch {
      return null;
    }
  }
}
