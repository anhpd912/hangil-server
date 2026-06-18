// Helper bắt buộc request đã đăng nhập (request.user gắn bởi plugins/auth.ts)
import type { FastifyRequest, FastifyReply } from "fastify";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: "Cần đăng nhập",
      code: "UNAUTHORIZED",
    });
  }
}
