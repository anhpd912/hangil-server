FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app

# GIT_SHA do Jenkins truyền vào (--build-arg). /health trả field này ra để smoke test
# sau deploy khẳng định đúng image mới đang chạy, không phải container cũ còn sống.
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

ENV NODE_ENV=production
# Giới hạn heap dưới mem_limit 400m của container — không đặt thì V8 có thể nới heap
# tới mức bị OOM-kill thay vì tự GC.
ENV NODE_OPTIONS=--max-old-space-size=320
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder --chown=node:node /app/dist ./dist

# Chạy non-root — image node:* có sẵn user "node"
USER node

EXPOSE 3201

# Docker tự restart/đánh dấu unhealthy khi /health không trả 2xx.
# Dùng fetch của Node 22 để không phải cài thêm curl vào image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3201/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
