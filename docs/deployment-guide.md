# Deployment Guide — VPS (Docker + Nginx)

DB (Neon) và Redis (Upstash) là managed cloud, không cần cài trên VPS. VPS chỉ chạy container API + Nginx reverse proxy + SSL.

## 1. Cài Docker trên VPS (Ubuntu/Debian)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout/login lại để áp dụng group docker
```

## 2. Clone code lên VPS

```bash
git clone https://github.com/anhpd912/hangil-server.git
cd hangil-server
git checkout feat/admin-dashboard   # hoặc main sau khi merge
```

## 3. Tạo `.env` trên VPS (KHÔNG commit, copy thủ công)

```bash
cp .env.example .env
nano .env   # điền DATABASE_URL, BETTER_AUTH_SECRET, UPSTASH_*, ANTHROPIC_API_KEY, v.v.
```

Sửa `FRONTEND_URL` thành domain thật của hangil-app (vd `https://hangil.vn`) — Better Auth `trustedOrigins` và CORS dùng giá trị này.

## 4. Build + chạy container

```bash
docker compose up -d --build
docker compose logs -f   # kiểm tra "Server listening at http://0.0.0.0:3201"
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

## 8. Update sau khi sửa code (thủ công, không có CI/CD)

```bash
git pull
docker compose up -d --build
```

## 9. CI/CD tự động (GitHub Actions) — `.github/workflows/deploy.yml`

Push lên `main` → tự build+test → SSH vào VPS (bằng password) → `git pull` + `docker compose up -d --build`. Set 3 secret trên GitHub repo:

```bash
# Trên máy local — set secret qua gh CLI (đã đăng nhập gh auth login)
gh secret set VPS_HOST --body "<ip-vps>"
gh secret set VPS_USER --body "<ssh-user>"
gh secret set VPS_PASSWORD --body "<ssh-password>"
```

Lưu ý: password auth qua CI kém an toàn hơn SSH key — đủ dùng cho MVP, nên đổi sang `ssh-keygen` + key riêng khi có thời gian (sửa lại `password:` → `key:` trong `deploy.yml`).

Repo trên VPS phải đã clone sẵn tại `~/hangil-server` (bước 2) và `.env` đã có (bước 3) — workflow chỉ pull + rebuild, không tạo lại từ đầu.

## Database migration (lần đầu / sau thay đổi schema)

```bash
docker compose exec api npx drizzle-kit push   # dev-friendly; dùng db:migrate nếu đã có migration files committed
```

## Troubleshooting

- `docker compose logs -f` — xem lỗi runtime (thiếu env var thường gặp nhất).
- CORS lỗi từ FE: kiểm tra `FRONTEND_URL` trong `.env` đúng domain FE thật, restart container sau khi sửa (`docker compose up -d --build`).
- 502 từ Nginx: container chưa chạy hoặc crash — `docker compose ps`.
