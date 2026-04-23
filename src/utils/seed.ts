/**
 * Seed Script — creates the SuperAdmin user in the database.
 * Run with: npm run seed
 * Credentials are loaded from the .env file.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User, { UserRole } from '../models/User';
import { logInfo, logSuccess, logError, logWarn } from '../utils/logger';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/noor';
const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'admin@noor.app';
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@1234';

/**
 * Checks if a SuperAdmin already exists, and creates one if not.
 * Prevents accidental duplicate seeding.
 */
const seedSuperAdmin = async (): Promise<void> => {
  await mongoose.connect(MONGO_URI);
  logInfo('Connected to MongoDB for seeding...');

  const existing = await User.findOne({ role: UserRole.SuperAdmin });
  if (existing) {
    logWarn(`SuperAdmin already exists (email: ${existing.email}). Skipping seed.`);
    await mongoose.disconnect();
    return;
  }

  // Hash the password with bcrypt (10 salt rounds)
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await User.create({
    name: 'Super Admin',
    city: 'Srinagar',
    email: ADMIN_EMAIL,
    passwordHash,
    role: UserRole.SuperAdmin,
  });

  logSuccess(`SuperAdmin seeded successfully!`);
  logInfo(`Email: ${ADMIN_EMAIL}`);
  logInfo(`Password: ${ADMIN_PASSWORD}`);
  logInfo('Change these credentials in your .env file before going to production.');

  await mongoose.disconnect();
};

seedSuperAdmin().catch((error) => {
  logError('Seeding failed:', error);
  process.exit(1);
});
