// Verify Better Auth bearer token từ Authorization header, attach request.user
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { auth } from "../lib/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      plan: string;
      track: string | null;
      role: string;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", undefined);

  fastify.addHook("onRequest", async (request) => {
    const authorization = request.headers.authorization;
    if (!authorization) return;

    const headers = new Headers();
    headers.set("authorization", authorization);

    const session = await auth.api.getSession({ headers });
    if (session?.user) {
      const sessionUser = session.user as typeof session.user & {
        plan?: string;
        track?: string | null;
        role?: string;
      };
      request.user = {
        id: sessionUser.id,
        email: sessionUser.email,
        plan: sessionUser.plan ?? "free",
        track: sessionUser.track ?? null,
        role: sessionUser.role ?? "user",
      };
    }
  });
};

export default fp(authPlugin, { name: "auth" });
