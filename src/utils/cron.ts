import cron from 'node-cron';
import MasjidSubscription, { SubscriptionStatus } from '../models/MasjidSubscription';
import { logInfo, logSuccess, logError } from './logger';

/**
 * Registers all background cron jobs.
 * Call this once after MongoDB is connected (in bootstrap).
 */
export function registerCronJobs(): void {

  /**
   * Subscription expiry check — runs every day at midnight (00:00).
   * - Marks active subscriptions as expired if currentPeriodEnd has passed.
   * - Marks trial subscriptions as expired if trialEndsAt has passed.
   */
  cron.schedule('0 0 * * *', async () => {
    logInfo('[Cron] Running subscription expiry check...');
    try {
      const now = new Date();

      // Expire active paid plans
      const expiredPaid = await MasjidSubscription.updateMany(
        {
          status:           SubscriptionStatus.Active,
          currentPeriodEnd: { $lt: now },
        },
        { $set: { status: SubscriptionStatus.Expired } }
      );

      // Expire trial plans
      const expiredTrial = await MasjidSubscription.updateMany(
        {
          status:      SubscriptionStatus.Trial,
          trialEndsAt: { $lt: now },
        },
        { $set: { status: SubscriptionStatus.Expired } }
      );

      const total = expiredPaid.modifiedCount + expiredTrial.modifiedCount;
      if (total > 0) {
        logSuccess(`[Cron] Marked ${total} subscription(s) as expired (paid: ${expiredPaid.modifiedCount}, trial: ${expiredTrial.modifiedCount})`);
      } else {
        logInfo('[Cron] Subscription check complete — no expirations.');
      }
    } catch (err) {
      logError('[Cron] Subscription expiry check failed', err);
    }
  });

  logInfo('[Cron] Subscription expiry job scheduled (daily at midnight).');
}
