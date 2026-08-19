#!/usr/bin/env bash
# Chạy TRÊN VPS. Jenkins không copy file này lên, mà pipe qua stdin:
#   ssh vps 'bash -s -- deploy <sha>' < deploy/remote-deploy.sh
# => VPS luôn chạy đúng bản script của commit đang deploy, không cần đồng bộ trước.
#
# Cách dùng:
#   deploy <short-sha>   kéo image tag đó, restart, chờ healthy, tự rollback nếu hỏng
#   rollback             quay lại tag xanh gần nhất ghi trong .env.deploy
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/hangil-server}
STATE_FILE="$APP_DIR/.env.deploy"
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3201/health}
RETRIES=${RETRIES:-20}
SLEEP=${SLEEP:-3}

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy][ERROR] %s\n' "$*" >&2; exit 1; }

cd "$APP_DIR" || die "không có $APP_DIR — xem docs/deployment-guide.md bước 2"

# .env.deploy giữ tag đang chạy + tag xanh trước đó. Untracked, chỉ tồn tại trên VPS.
CURRENT_TAG=""
PREVIOUS_TAG=""
if [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  CURRENT_TAG=${IMAGE_TAG:-}
  PREVIOUS_TAG=${PREVIOUS_IMAGE_TAG:-}
fi

write_state() {
  cat > "$STATE_FILE" <<EOF
IMAGE_TAG=$1
PREVIOUS_IMAGE_TAG=$2
EOF
}

# Chờ container trả /health VÀ đúng commit mong đợi. Chỉ check 200 là chưa đủ:
# nếu `up -d` không thay được container, container CŨ vẫn trả 200 và deploy hỏng đi qua im lặng.
wait_healthy() {
  local expected=$1 body commit i
  for i in $(seq 1 "$RETRIES"); do
    body=$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)
    commit=$(printf '%s' "$body" | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p')
    if [ -n "$commit" ]; then
      [ "$commit" = "$expected" ] && { log "healthy, commit=$commit (lần $i)"; return 0; }
      log "đang chạy commit=$commit, chờ $expected (lần $i/$RETRIES)"
    else
      log "chưa trả lời (lần $i/$RETRIES)"
    fi
    sleep "$SLEEP"
  done
  return 1
}

start_tag() {
  local tag=$1
  IMAGE_TAG="$tag" docker compose pull
  IMAGE_TAG="$tag" docker compose up -d --remove-orphans
}

do_deploy() {
  local tag=$1
  [ -n "$tag" ] || die "thiếu tham số <short-sha>"

  # Đồng bộ repo về đúng commit của image — docker-compose.yml trên VPS phải khớp image đang chạy.
  log "fetch + reset về $tag"
  git fetch --quiet origin main
  git reset --quiet --hard "$tag" || die "commit $tag không có trên VPS (fetch hỏng?)"

  log "deploy $tag (bản đang chạy: ${CURRENT_TAG:-chưa rõ})"
  start_tag "$tag"

  if wait_healthy "$tag"; then
    # Chỉ ghi PREVIOUS khi bản mới đã xanh — nếu không, một lần deploy hỏng sẽ
    # ghi đè mất tag xanh cuối cùng và rollback không còn chỗ để quay về.
    write_state "$tag" "${CURRENT_TAG:-$tag}"
    docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
    log "OK — $tag đang chạy"
    return 0
  fi

  log "health check thất bại sau $((RETRIES * SLEEP))s"
  docker compose logs --tail 50 api || true
  if [ -n "$CURRENT_TAG" ] && [ "$CURRENT_TAG" != "$tag" ]; then
    log "tự rollback về $CURRENT_TAG"
    start_tag "$CURRENT_TAG"
    wait_healthy "$CURRENT_TAG" && log "rollback OK" || log "rollback CŨNG hỏng — cần vào tay"
  else
    log "không có bản trước để rollback"
  fi
  die "deploy $tag thất bại"
}

do_rollback() {
  [ -n "$PREVIOUS_TAG" ] || die "không có PREVIOUS_IMAGE_TAG trong $STATE_FILE"
  log "rollback về $PREVIOUS_TAG"
  git fetch --quiet origin main && git reset --quiet --hard "$PREVIOUS_TAG" || true
  start_tag "$PREVIOUS_TAG"
  wait_healthy "$PREVIOUS_TAG" || die "rollback về $PREVIOUS_TAG vẫn không healthy"
  write_state "$PREVIOUS_TAG" "$PREVIOUS_TAG"
  log "rollback OK"
}

case "${1:-}" in
  deploy)   do_deploy "${2:-}" ;;
  rollback) do_rollback ;;
  *)        die "dùng: $0 deploy <short-sha> | rollback" ;;
esac
