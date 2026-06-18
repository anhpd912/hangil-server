// Admin route: GET /waitlist — danh sách email chờ release, dùng để export gửi mail sau
import type { FastifyPluginAsync } from "fastify";
import { count, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { waitlistEntries } from "../../db/schema.js";
import { adminWaitlistListQuerySchema } from "../../lib/validators-admin.js";

const adminWaitlistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/waitlist", async (request, reply) => {
    const parsed = adminWaitlistListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Query không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const { page, pageSize } = parsed.data;

    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(waitlistEntries)
        .orderBy(desc(waitlistEntries.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() }).from(waitlistEntries),
    ]);

    return reply.send({
      success: true,
      data: { entries: rows, page, pageSize, total: total?.value ?? 0 },
    });
  });
};

export default adminWaitlistRoutes;
