// Route: PATCH /me — user tự cập nhật profile/onboarding (khác /admin/users/:id, không cần requireAdmin)
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user } from "../db/schema.js";
import { requireAuth } from "../lib/require-auth.js";
import { meUpdateBodySchema } from "../lib/validators.js";

const meRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.patch("/me", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = meUpdateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const [updated] = await db
      .update(user)
      .set(parsed.data)
      .where(eq(user.id, request.user!.id))
      .returning();

    return reply.send({ success: true, data: updated });
  });
};

export default meRoutes;
