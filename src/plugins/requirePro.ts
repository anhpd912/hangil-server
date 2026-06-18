// preHandler chặn route chỉ dành cho gói Pro
import type { FastifyRequest, FastifyReply } from "fastify";

export async function requirePro(request: FastifyRequest, reply: FastifyReply) {
  if (request.user?.plan !== "pro") {
    return reply.status(403).send({
      success: false,
      error: "Tính năng này yêu cầu gói Pro",
      code: "PRO_REQUIRED",
    });
  }
}
