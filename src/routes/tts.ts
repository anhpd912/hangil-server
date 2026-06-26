// Routes: GET /tts?text=... — proxy ElevenLabs TTS for Korean pronunciation
import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../lib/require-auth.js";
import { AppError } from "../lib/errors.js";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // Rachel — eleven_multilingual_v2

const ttsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/tts", { preHandler: requireAuth }, async (request, reply) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new AppError("INTERNAL_ERROR", "TTS not configured", 500);

    const { text } = request.query as { text?: string };
    if (!text || text.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", "text query param required", 400);
    }
    if (text.length > 200) {
      throw new AppError("VALIDATION_ERROR", "text too long (max 200 chars)", 400);
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!upstream.ok) {
      fastify.log.error(`ElevenLabs error: ${upstream.status}`);
      throw new AppError("INTERNAL_ERROR", "TTS service error", 502);
    }

    const buffer = await upstream.arrayBuffer();
    reply.header("Content-Type", "audio/mpeg");
    reply.header("Cache-Control", "public, max-age=86400");
    return reply.send(Buffer.from(buffer));
  });
};

export default ttsRoutes;
