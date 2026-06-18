// Route public: POST /waitlist — landing page thu email chờ release, gửi mail sau qua services/email (Resend)
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { waitlistEntries } from "../db/schema.js";
import { waitlistJoinBodySchema } from "../lib/validators.js";

const waitlistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/waitlist", async (request, reply) => {
    const parsed = waitlistJoinBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Email không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    // onConflictDoNothing: email đã đăng ký rồi vẫn trả success, tránh dò email tồn tại
    await db
      .insert(waitlistEntries)
      .values({ email: parsed.data.email })
      .onConflictDoNothing({ target: waitlistEntries.email });

    return reply.status(201).send({ success: true, data: { email: parsed.data.email } });
  });
};

export default waitlistRoutes;
