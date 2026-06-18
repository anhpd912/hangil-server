// Better Auth config — user table extended with Hangil app fields
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "../db/auth-schema.js";

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: [process.env.FRONTEND_URL ?? "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
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
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },
});
