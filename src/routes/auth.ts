// Routes /auth/* — proxy sang Better Auth built-in handler
import type { FastifyPluginAsync } from "fastify";
import { auth } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";

/** Fastify headers → Web Headers, dạng Better Auth handler/api nhận được. */
function toWebHeaders(raw: NodeJS.Dict<string | string[]>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Đổi cookie phiên lấy bearer token — chỉ dùng cho luồng OAuth.
  // Sau khi Google/Facebook redirect về, Better Auth đã set cookie phiên nhưng
  // header `set-auth-token` thì JS không đọc được (header của một lần điều hướng).
  // Frontend gọi endpoint này đúng một lần kèm cookie để nạp token vào localStorage.
  // Route tĩnh nên luôn được ưu tiên trước wildcard /auth/* bên dưới.
  fastify.get("/auth/bearer-token", async (request, reply) => {
    const session = await auth.api.getSession({ headers: toWebHeaders(request.headers) });
    if (!session) {
      throw new AppError("Phiên đăng nhập không hợp lệ", "UNAUTHORIZED", 401);
    }
    // Plugin bearer chấp nhận token chưa ký và tự ký lại khi verify, nên trả
    // thẳng token trong DB — không cần bóc giá trị cookie đã ký.
    return reply.send({ success: true, data: { token: session.session.token } });
  });

  fastify.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    handler: async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host}`);

      const webRequest = new Request(url, {
        method: request.method,
        headers: toWebHeaders(request.headers),
        body: request.method === "GET" || request.method === "HEAD"
          ? undefined
          : JSON.stringify(request.body ?? {}),
      });

      const response = await auth.handler(webRequest);

      reply.status(response.status);
      // Headers.forEach gộp nhiều Set-Cookie thành một chuỗi nối bằng ", " (đúng
      // spec Fetch) làm hỏng cookie state/phiên của OAuth. getSetCookie() giữ
      // nguyên từng cookie; reply.header("set-cookie", ...) gọi nhiều lần thì
      // Fastify tự dồn thành mảng nên mỗi cookie ra một dòng riêng.
      const setCookies = response.headers.getSetCookie();
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") return;
        reply.header(key, value);
      });
      for (const cookie of setCookies) reply.header("set-cookie", cookie);

      const text = await response.text();
      return reply.send(text);
    },
  });
};

export default authRoutes;
