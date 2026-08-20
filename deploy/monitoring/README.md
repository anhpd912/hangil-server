# Monitoring stack — Prometheus + Loki + Grafana

Chạy trên chính VPS (2GB RAM), thư mục `/opt/monitoring`. Tách khỏi repo API để restart
API không đụng monitoring và ngược lại.

```
API container ──/metrics──► Prometheus ──┐
docker logs ──► Alloy ─────► Loki ───────┼──► Grafana ──► Telegram
VPS ──► node-exporter ───────────────────┘
```

## Ngân sách RAM (vì sao cấu hình lại chặt như vậy)

| Thành phần | mem_limit | Thực tế ước tính |
|---|---:|---:|
| OS + sshd + nginx | — | ~300 MB |
| API | 400m | 150–220 MB |
| Prometheus | 300m | 180–250 MB |
| Loki | 300m | 150–250 MB |
| Alloy | 192m | 90–150 MB |
| Grafana | 256m | 120–180 MB |
| node-exporter | 64m | ~15 MB |
| **Tổng** | | **~1.1–1.4 GB / 2 GB** |

Vì sát trần nên: retention 7 ngày, scrape 30s, node-exporter chỉ bật 6 collector,
`GOMEMLIMIT` cho Loki, và **bắt buộc có swap**:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf && sudo sysctl --system
```

Jenkins **không** chạy ở đây — 600MB idle, 1–1.5GB lúc build, không còn chỗ. Xem `deploy/jenkins/`.

## Cài đặt

```bash
# API phải chạy trước — network hangil-net do compose của API tạo (external ở đây)
docker network ls | grep hangil-net || (cd /opt/hangil-server && docker compose up -d)

sudo mkdir -p /opt/monitoring && sudo chown $USER:$USER /opt/monitoring
cp -r /opt/hangil-server/deploy/monitoring/* /opt/monitoring/
cd /opt/monitoring && cp .env.example .env && nano .env   # GF_ADMIN_PASSWORD, TELEGRAM_*

docker compose -f docker-compose.monitoring.yml up -d
docker compose -f docker-compose.monitoring.yml ps
```

## Expose Grafana qua HTTPS

```bash
# Trỏ DNS A record grafana.hangil.io.vn → IP VPS trước
sudo cp /opt/hangil-server/deploy/nginx-grafana.conf /etc/nginx/sites-available/grafana
sudo ln -s /etc/nginx/sites-available/grafana /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d grafana.hangil.io.vn
```

Không mở thêm port ufw — Grafana bind `127.0.0.1:3000`, Nginx là cổng duy nhất.
Grafana có login riêng nên không chồng thêm basic auth; `allow_sign_up` đã tắt.

## Kiểm tra

```bash
# 4 target phải UP: hangil-api, node, prometheus, loki
curl -s localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"' | sort | uniq -c

# Loki đã nhận log chưa
curl -s "localhost:3100/loki/api/v1/labels" | head

# Alloy có đang đẩy log không (0 = có vấn đề, xem docker logs hangil-alloy)
docker exec hangil-alloy wget -qO- http://127.0.0.1:12345/metrics | grep loki_write_sent_entries_total

free -h            # available phải còn > 500MB
docker stats --no-stream   # so MEM USAGE với LIMIT từng container
```

Trong Grafana: dashboard **Hangil / Hangil API** đã tự nạp. Dashboard hệ thống thì
import ID **1860** (Node Exporter Full), chọn datasource Prometheus.

Explore → Loki → `{container="hangil-api"} |= "error"` để soi log.

## Alert

8 rule provisioned sẵn (`grafana/provisioning/alerting/alert-rules.yml`), gửi Telegram.

⚠️ Contact point Telegram và notification policy **không** provisioning được — phải tạo
bằng UI một lần sau khi dựng. Lý do và các bước: `grafana/alerting-manual/README.md`.
Chưa làm bước đó thì rule vẫn chạy nhưng không có gì gửi đi.


| Rule | Ngưỡng | Mức |
|---|---|---|
| API down | `up == 0` trong 2m (NoData cũng kêu) | critical |
| Tỉ lệ 5xx cao | > 5% trong 5m | critical |
| p95 latency | > 1s trong 10m | warning |
| Event loop lag | p99 > 200ms trong 5m | warning |
| API sắp chạm mem_limit | RSS > 340MB trong 10m | warning |
| RAM VPS cạn | available < 15% trong 10m | warning |
| Disk VPS đầy | > 80% trong 10m | warning |
| Log lỗi tăng đột biến | > 20 dòng `level=error` / 5m | warning |

Cert hết hạn dùng cron thay vì blackbox-exporter (tiết kiệm RAM):

```bash
cp /opt/hangil-server/deploy/monitoring/check-cert-expiry.sh /opt/monitoring/
crontab -e   # 0 9 * * * /opt/monitoring/check-cert-expiry.sh >> /var/log/cert-check.log 2>&1
```

**Thử alert thật:** `cd /opt/hangil-server && docker compose stop api` → sau ~2 phút phải
có Telegram → `docker compose start api` → phải có tin resolved.

## Sửa cấu hình

Rule, dashboard, datasource đều là file trong repo `hangil-server/deploy/monitoring/`.
Sửa trên UI sẽ bị ghi đè (`allowUiUpdates: false`, provisioned rule là read-only).
Quy trình: sửa file trong repo → copy lên `/opt/monitoring` → restart service tương ứng.

```bash
docker compose -f docker-compose.monitoring.yml restart grafana
curl -X POST localhost:9090/-/reload    # Prometheus nạp lại config, không cần restart
```

## Khi RAM căng

1. `docker stats` xem container nào vượt xa ước tính.
2. Hạ retention: Prometheus `--storage.tsdb.retention.time=3d`, Loki `retention_period: 72h`.
3. Cắt log ít giá trị ở `alloy/config.alloy` (thêm `stage.drop`).
4. Cuối cùng mới bỏ Grafana khỏi VPS và dùng Grafana Cloud free tier.
