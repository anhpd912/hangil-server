// Admin routes: GET /users (list+search+paginate), GET /users/:id (detail), PATCH /users/:id (plan/role)
import type { FastifyPluginAsync } from "fastify";
import { and, count, eq, ilike, isNotNull, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { user, userCards, userProgress } from "../../db/schema.js";
import {
  adminUsersListQuerySchema,
  adminUserPatchBodySchema,
} from "../../lib/validators-admin.js";

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/users", async (request, reply) => {
    const parsed = adminUsersListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Query không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const { search, page, pageSize } = parsed.data;
    const where = search
      ? or(ilike(user.email, `%${search}%`), ilike(user.name, `%${search}%`))
      : undefined;

    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(user)
        .where(where)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() }).from(user).where(where),
    ]);

    return reply.send({
      success: true,
      data: { users: rows, page, pageSize, total: total?.value ?? 0 },
    });
  });

  fastify.get<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const { id } = request.params;

    const [[userRow], [cardsTotal], [lessonsDone]] = await Promise.all([
      db.select().from(user).where(eq(user.id, id)).limit(1),
      db.select({ value: count() }).from(userCards).where(eq(userCards.userId, id)),
      db
        .select({ value: count() })
        .from(userProgress)
        .where(and(eq(userProgress.userId, id), isNotNull(userProgress.completedAt))),
    ]);

    if (!userRow) {
      return reply.status(404).send({
        success: false,
        error: "Không tìm thấy user",
        code: "USER_NOT_FOUND",
      });
    }

    return reply.send({
      success: true,
      data: { ...userRow, totalCards: cardsTotal?.value ?? 0, lessonsDone: lessonsDone?.value ?? 0 },
    });
  });

  fastify.patch<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const parsed = adminUserPatchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const { id } = request.params;
    if (parsed.data.role === "user" && id === request.user!.id) {
      return reply.status(400).send({
        success: false,
        error: "Không thể tự hạ quyền admin của chính mình",
        code: "SELF_DEMOTE_FORBIDDEN",
      });
    }

    const [updated] = await db.update(user).set(parsed.data).where(eq(user.id, id)).returning();
    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: "Không tìm thấy user",
        code: "USER_NOT_FOUND",
      });
    }

    return reply.send({ success: true, data: updated });
  });
};

export default adminUsersRoutes;
