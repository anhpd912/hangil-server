# Jenkins CI/CD — hangil-server

Jenkins chạy ở **máy local**, không phải trên VPS: VPS chỉ 2GB RAM, đủ cho API + monitoring
nhưng không đủ cho Jenkins (~600MB idle, 1–1.5GB lúc build). Luồng:

```
push main → Jenkins poll (5') → npm ci/build/test → docker build → push GHCR
         → ssh VPS: docker compose pull + up -d → smoke test → rollback nếu hỏng
```

VPS **không build image nữa**, chỉ `pull` — nhẹ hơn cách cũ (GitHub Actions SSH vào rồi
`up -d --build`, tức VPS tự chạy `npm ci` + `tsc` giữa lúc phục vụ production).

## 1. Dựng Jenkins

Bật Docker Desktop trước, rồi từ thư mục gốc repo:

```bash
docker compose -f deploy/jenkins/docker-compose.yml up -d --build
docker logs hangil-jenkins 2>&1 | grep -A2 "initialAdminPassword"   # mật khẩu lần đầu
```

Mở http://localhost:8081 → dán mật khẩu → chọn **Install suggested plugins** →
tạo admin user. Plugin cần cho pipeline đã nướng sẵn trong image (`plugins.txt`).

## 2. Credentials (Manage Jenkins → Credentials → System → Global)

| ID | Kiểu | Giá trị |
|---|---|---|
| `ghcr-token` | Username with password | username GitHub + PAT scope `write:packages` |
| `vps-ssh-key` | SSH Username with private key | user SSH của VPS + private key ed25519 |
| `vps-ssh-target` | Secret text | `user@ip-vps` (để IP không nằm trong repo) |
| `telegram-bot-token` | Secret text | token từ @BotFather (tuỳ chọn) |
| `telegram-chat-id` | Secret text | chat id nhận thông báo (tuỳ chọn) |

ID phải khớp đúng chữ — `Jenkinsfile` gọi theo tên này.

### Tạo SSH key deploy (thay password auth hiện tại)

```bash
ssh-keygen -t ed25519 -C "jenkins-deploy" -f ~/.ssh/hangil_deploy   # để trống passphrase
ssh-copy-id -i ~/.ssh/hangil_deploy.pub <user>@<ip-vps>
ssh -i ~/.ssh/hangil_deploy <user>@<ip-vps> 'echo ok'               # phải in "ok"
```

Dán nội dung `~/.ssh/hangil_deploy` (private key) vào credential `vps-ssh-key`.
Sau khi pipeline chạy xanh, cân nhắc tắt `PasswordAuthentication no` trong `/etc/ssh/sshd_config`.

## 3. Chuẩn bị VPS

```bash
sudo mkdir -p /opt/hangil-server && sudo chown $USER:$USER /opt/hangil-server
git clone https://github.com/anhpd912/hangil-server.git /opt/hangil-server
cd /opt/hangil-server && cp .env.example .env && nano .env
echo "<github-pat-read:packages>" | docker login ghcr.io -u anhpd912 --password-stdin
```

`docker login` phải làm một lần bằng tay — pipeline không truyền credential GHCR sang VPS.

## 4. Tạo job

New Item → **Pipeline** → tên `hangil-server` → mục Pipeline chọn
**Pipeline script from SCM** → Git → URL repo → branch `main` → Script Path `Jenkinsfile`.
Trigger `pollSCM` đã khai trong `Jenkinsfile`, không cần tick gì trong UI.

Chạy **Build Now** một lần để Jenkins đọc được `triggers {}` (Jenkins chỉ nạp trigger sau
lần build đầu — đây là hành vi cố hữu của "pipeline from SCM").

## 5. Kiểm tra

- Image xuất hiện ở https://github.com/anhpd912?tab=packages với tag = short SHA.
- Trên VPS: `docker ps` thấy `hangil-api` STATUS `healthy`; `cat /opt/hangil-server/.env.deploy`
  thấy `IMAGE_TAG` + `PREVIOUS_IMAGE_TAG`.
- `curl -s https://api.hangil.io.vn/health` trả `commit` đúng SHA vừa build.
- Thử rollback: `ssh vps 'bash -s -- rollback' < deploy/remote-deploy.sh`.

## Ghi chú

- **Jenkins chỉ chạy khi máy local bật.** Push lúc máy tắt sẽ được build ở lần poll kế tiếp
  sau khi bật máy — không mất commit, chỉ trễ.
- Cổng chất lượng `npm test` hiện chỉ có 6 test cho thuật toán SM-2; route/auth/AI chưa có test.
  Pipeline auto-deploy chỉ đáng tin bằng đúng bộ test này.
- `.github/workflows/ci.yml` giữ lại làm cổng build/test cho PR, không deploy —
  không để hai hệ thống cùng deploy một VPS.
