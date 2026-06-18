// preHandler chặn route chỉ dành cho admin
import type { FastifyRequest, FastifyReply } from "fastify";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.user?.role !== "admin") {
    return reply.status(403).send({
      success: false,
      error: "Yêu cầu quyền admin",
      code: "ADMIN_REQUIRED",
    });
  }
}
