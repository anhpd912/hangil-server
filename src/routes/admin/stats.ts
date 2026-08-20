// Admin routes: /stats/* — số liệu vận hành cho dashboard.
// Toàn bộ truy vấn nằm ở services/admin-dashboard/*, route chỉ validate + đóng envelope.
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAdminStats } from "../../services/admin-dashboard/overview-stats.js";
import { getRecentActivity } from "../../services/admin-dashboard/recent-activity.js";
import { getDailyActivity } from "../../services/admin-dashboard/daily-activity.js";
import { getServiceHealth } from "../../services/admin-dashboard/service-health.js";

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const timeseriesQuerySchema = z.object({
  days: z.coerce.number().int().min(2).max(30).default(7),
});

const adminStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/stats", async (_request, reply) => {
    return reply.send({ success: true, data: await getAdminStats() });
  });

  fastify.get("/stats/activity", async (request, reply) => {
    const parsed = activityQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Query không hợp lệ", code: "VALIDATION_ERROR" });
    }

    const items = await getRecentActivity(parsed.data.limit);
    return reply.send({ success: true, data: { items } });
  });

  fastify.get("/stats/timeseries", async (request, reply) => {
    const parsed = timeseriesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Query không hợp lệ", code: "VALIDATION_ERROR" });
    }

    const points = await getDailyActivity(parsed.data.days);
    return reply.send({ success: true, data: { days: parsed.data.days, points } });
  });

  // Chạm DB + Redis mỗi lần gọi nên tắt rate limit toàn cục sẽ nguy hiểm; giữ nguyên quota mặc định.
  fastify.get("/stats/services", async (_request, reply) => {
    const services = await getServiceHealth();
    return reply.send({ success: true, data: { services, checkedAt: new Date().toISOString() } });
  });
};

export default adminStatsRoutes;
