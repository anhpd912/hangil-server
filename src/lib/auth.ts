// Better Auth config — user table extended with Hangil app fields
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "../db/auth-schema.js";

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: [
    process.env.FRONTEND_URL ?? "http://localhost:3000",
    process.env.ADMIN_FRONTEND_URL ?? "http://localhost:3100",
  ],
  emailAndPassword: {
    enabled: true,
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
