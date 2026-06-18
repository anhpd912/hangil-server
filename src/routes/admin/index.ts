// Mount tất cả admin routes, gắn requireAuth + requireAdmin cho toàn bộ scope /admin/*
import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../lib/require-auth.js";
import { requireAdmin } from "../../plugins/require-admin.js";
import adminUsersRoutes from "./users.js";
import adminLessonsRoutes from "./lessons.js";
import adminVocabularyRoutes from "./vocabulary.js";
import adminStatsRoutes from "./stats.js";
import adminWaitlistRoutes from "./waitlist.js";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", requireAdmin);

  await fastify.register(adminUsersRoutes);
  await fastify.register(adminLessonsRoutes);
  await fastify.register(adminVocabularyRoutes);
  await fastify.register(adminStatsRoutes);
  await fastify.register(adminWaitlistRoutes);
};

export default adminRoutes;
