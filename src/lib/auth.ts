// Better Auth config — user table extended with Hangil app fields
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "../db/auth-schema.js";
import { sendResetPasswordEmail } from "../services/email.js";
import { logger } from "./logger.js";

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: [
    process.env.FRONTEND_URL ?? "http://localhost:3000",
    process.env.ADMIN_FRONTEND_URL ?? "http://localhost:3100",
  ],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url: _url, token }) => {
      // Better Auth's `url` is {BETTER_AUTH_URL}/reset-password/{token}?callbackURL=...
      // Token is a PATH segment, not a query param — so we build the frontend URL
      // directly from the `token` param rather than parsing the backend URL.
      const frontendBase = process.env.FRONTEND_URL ?? "http://localhost:3000";
      const resetUrl = `${frontendBase}/reset-password?token=${encodeURIComponent(token)}`;
      logger.info({ to: user.email }, "[auth] sendResetPassword → token received");
      const result = await sendResetPasswordEmail(user.email, resetUrl);
      if (!result.ok) {
        logger.error({ to: user.email, err: result.error }, "[auth] sendResetPassword failed");
        throw new Error(result.error);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID ?? "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? "",
    },
  },
  plugins: [bearer()],
  user: {
    additionalFields: {
      plan: {
        type: "string",
        defaultValue: "free",
        input: false,
      },
      track: {
        type: "string",
        required: false,
      },
      streakCount: {
        type: "number",
        defaultValue: 0,
        input: false,
      },
      lastStudiedAt: {
        type: "date",
        required: false,
        input: false,
      },
      xp: {
        type: "number",
        defaultValue: 0,
        input: false,
      },
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
      onboardingCompleted: {
        type: "boolean",
        defaultValue: false,
        input: true,
      },
      dailyGoalMinutes: {
        type: "number",
        required: false,
        input: true,
      },
    },
  },
});
