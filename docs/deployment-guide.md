# Deployment Guide — VPS (Docker + Nginx)

DB (Neon) và Redis (Upstash) là managed cloud, không cần cài trên VPS. VPS chỉ chạy container API + Nginx reverse proxy + SSL.

## 1. Cài Docker trên VPS (Ubuntu/Debian)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout/login lại để áp dụng group docker
```

## 2. Clone code lên VPS

Đường dẫn chuẩn là `/opt/hangil-server` — pipeline deploy `cd` vào đúng path này, đặt chỗ khác thì deploy fail.

```bash
sudo mkdir -p /opt/hangil-server && sudo chown $USER:$USER /opt/hangil-server
git clone https://github.com/anhpd912/hangil-server.git /opt/hangil-server
cd /opt/hangil-server
```

VPS **không build image** — chỉ cần `docker-compose.yml` và `.env` ở đây, image kéo từ GHCR.

## 3. Tạo `.env` trên VPS (KHÔNG commit, copy thủ công)

```bash
cp .env.example .env
nano .env   # điền DATABASE_URL, BETTER_AUTH_SECRET, UPSTASH_*, ANTHROPIC_API_KEY, v.v.
```

Sửa `FRONTEND_URL` thành domain thật của hangil-app (vd `https://hangil.vn`) — Better Auth `trustedOrigins` và CORS dùng giá trị này.

## 4. Kéo image + chạy container

Image build ở CI rồi push lên GHCR (`ghcr.io/anhpd912/hangil-server`). VPS 2GB không tự build —
`npm ci` + `tsc` + `docker build` ăn RAM của chính production.

```bash
# package private → cần login GHCR một lần bằng PAT scope read:packages
echo "<github-pat>" | docker login ghcr.io -u anhpd912 --password-stdin

IMAGE_TAG=latest docker compose pull
IMAGE_TAG=latest docker compose up -d
docker compose logs -f   # kiểm tra "Server listening at http://0.0.0.0:3201"
```

`IMAGE_TAG` mặc định là `latest`; deploy thật dùng tag commit SHA để rollback được về bản trước.

Kiểm tra nhanh:

```bash
curl -s localhost:3201/health          # {"success":true,"data":{"status":"ok",...,"commit":"<sha>"}}
curl -s localhost:3201/health/ready    # 503 nếu Neon hoặc Upstash không tới được
```

Port chỉ bind `127.0.0.1:3201` (xem `docker-compose.yml`) — không lộ trực tiếp ra internet, Nginx mới là cổng public.

## 5. Cài Nginx + cấu hình reverse proxy

```bash
sudo apt install -y nginx
sudo cp deploy/nginx-api-hangil.conf /etc/nginx/sites-available/api-hangil
# sửa server_name trong file thành domain thật trước khi cp, nếu chưa sửa:
sudo sed -i 's/api.hangil.vn/<domain-thuc-cua-ban>/' /etc/nginx/sites-available/api-hangil
sudo ln -s /etc/nginx/sites-available/api-hangil /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. SSL (Let's Encrypt) — domain phải đã trỏ DNS về VPS trước bước này

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <domain-thuc-cua-ban>
```

Certbot tự sửa Nginx config thêm `listen 443 ssl` + tự gia hạn (systemd timer `certbot.timer`).

## 7. Firewall

```bash
sudo ufw allow 22,80,443/tcp
sudo ufw enable
```

## 8. Deploy thủ công (khi CI đang hỏng)

```bash
cd /opt/hangil-server
git pull                       # chỉ để lấy docker-compose.yml mới, không build
export IMAGE_TAG=<commit-sha>  # tag đã có trên GHCR
docker compose pull && docker compose up -d
curl -fsS https://api.hangil.io.vn/health
```

Rollback = chạy lại đúng các lệnh trên với `IMAGE_TAG` của bản xanh trước đó.

## 9. CI/CD tự động (Jenkins) — `Jenkinsfile`

Jenkins chạy ở **máy local**, không phải trên VPS: 2GB RAM đủ cho API + monitoring nhưng
không đủ cho Jenkins (~600MB idle, 1–1.5GB lúc build).

```
push main → Jenkins poll (5') → npm ci / build / test → docker build --build-arg GIT_SHA
         → push GHCR → ssh VPS: pull + up -d → chờ /health trả đúng commit
         → smoke test qua https → rollback + báo Telegram nếu hỏng
```

Hướng dẫn dựng Jenkins, tạo credentials và SSH key deploy: `deploy/jenkins/README.md`.
Script chạy trên VPS: `deploy/remote-deploy.sh` (pipe qua stdin, VPS không cần có sẵn).

`.github/workflows/ci.yml` chỉ còn build + test — cổng chất lượng cho PR, không đụng tới
VPS, nên không có chuyện hai hệ thống cùng deploy.

## 10. Monitoring (Prometheus + Loki + Grafana)

Xem `deploy/monitoring/README.md`. Lưu ý bật API trước (network `hangil-net`) và thêm
swap 2GB trước khi dựng stack.

## Database migration (lần đầu / sau thay đổi schema)

Image production build bằng `npm ci --omit=dev` nên **không có drizzle-kit bên trong container**.
Chạy migration từ máy local, trỏ thẳng vào Neon:

```bash
DATABASE_URL="<neon-url-production>" npm run db:migrate   # prod
DATABASE_URL="<neon-url-production>" npm run db:push      # dev-friendly, không sinh migration file
```

## Troubleshooting

- `docker compose logs -f` — xem lỗi runtime (thiếu env var thường gặp nhất).
- CORS lỗi từ FE: kiểm tra `FRONTEND_URL` trong `.env` đúng domain FE thật, restart container sau khi sửa (`docker compose up -d --force-recreate`).
- 502 từ Nginx: container chưa chạy hoặc crash — `docker compose ps` (cột STATUS phải là `healthy`).
- `/health` trả `commit` khác SHA vừa deploy: container cũ còn sống, `docker compose up -d` chưa thay được — `docker compose up -d --force-recreate`.
- Container `unhealthy`: `curl localhost:3201/health/ready` để biết Neon hay Upstash mới là thứ hỏng.
