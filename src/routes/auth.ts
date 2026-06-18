// Routes /auth/* — proxy sang Better Auth built-in handler
import type { FastifyPluginAsync } from "fastify";
import { auth } from "../lib/auth.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    handler: async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }

      const webRequest = new Request(url, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD"
          ? undefined
          : JSON.stringify(request.body ?? {}),
      });

      const response = await auth.handler(webRequest);

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      const text = await response.text();
      return reply.send(text);
    },
  });
};

export default authRoutes;
