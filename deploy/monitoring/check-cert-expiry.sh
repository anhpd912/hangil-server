#!/usr/bin/env bash
# Cảnh báo Telegram khi cert Let's Encrypt sắp hết hạn.
# Chạy bằng cron thay vì blackbox-exporter — tiết kiệm ~40MB RAM cho một việc mỗi ngày làm 1 lần.
#
#   crontab -e
#   0 9 * * * /opt/monitoring/check-cert-expiry.sh >> /var/log/cert-check.log 2>&1
set -euo pipefail

DOMAINS=${DOMAINS:-"api.hangil.io.vn grafana.hangil.io.vn"}
WARN_DAYS=${WARN_DAYS:-14}
ENV_FILE=${ENV_FILE:-/opt/monitoring/.env}

[ -f "$ENV_FILE" ] && . "$ENV_FILE"

notify() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || { echo "$1"; return; }
  curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$1" >/dev/null || true
}

for domain in $DOMAINS; do
  end_date=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2) || end_date=""

  if [ -z "$end_date" ]; then
    notify "🔴 Không đọc được cert của $domain — domain chết hoặc SSL hỏng?"
    continue
  fi

  days_left=$(( ( $(date -d "$end_date" +%s) - $(date +%s) ) / 86400 ))
  echo "$domain: còn $days_left ngày ($end_date)"

  # certbot.timer tự gia hạn ở mốc 30 ngày; còn dưới 14 ngày nghĩa là auto-renew đã hỏng.
  [ "$days_left" -lt "$WARN_DAYS" ] && \
    notify "🟠 Cert $domain còn $days_left ngày — kiểm tra: systemctl status certbot.timer; certbot renew --dry-run"
done
