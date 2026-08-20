// Pipeline CI/CD hangil-server. Jenkins chạy ở máy local (không phải VPS 2GB):
// build + test + docker build ở đây, VPS chỉ `docker compose pull` — nhẹ hơn hẳn cách cũ
// (GitHub Actions SSH vào VPS rồi `up -d --build`, tức VPS tự biên dịch giữa lúc chạy production).
//
// Credentials cần tạo sẵn trong Jenkins (Manage Jenkins → Credentials):
//   ghcr-token      Username/Password  — GitHub user + PAT scope write:packages
//   vps-ssh-key     SSH private key    — key deploy, thay password auth
//   vps-ssh-target  Secret text        — "user@ip" của VPS (không commit IP vào repo)
//   telegram-bot-token / telegram-chat-id  Secret text — báo kết quả (tuỳ chọn)

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()          // hai build cùng deploy một VPS = hỏng
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  triggers {
    // Máy local không có IP public cho webhook → poll. Trễ tối đa 5 phút, chấp nhận được.
    pollSCM('H/5 * * * *')
  }

  environment {
    IMAGE      = 'ghcr.io/anhpd912/hangil-server'
    HEALTH_URL = 'https://api.hangil.io.vn/health'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.GIT_SHA}"
        }
      }
    }

    stage('Install') {
      steps { sh 'npm ci' }
    }

    stage('Build') {
      // `npm run build` chính là bước typecheck — repo không có script lint riêng
      steps { sh 'npm run build' }
    }

    stage('Test') {
      steps { sh 'npm test' }
    }

    stage('Docker build & push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'ghcr-token',
                                          usernameVariable: 'GHCR_USER',
                                          passwordVariable: 'GHCR_TOKEN')]) {
          // Secret đi qua biến môi trường, không nội suy Groovy vào lệnh sh
          sh '''
            set -eu
            echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
            docker build --build-arg GIT_SHA="$GIT_SHA" -t "$IMAGE:$GIT_SHA" -t "$IMAGE:latest" .
            docker push "$IMAGE:$GIT_SHA"
            docker push "$IMAGE:latest"
            docker logout ghcr.io
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        sshagent(credentials: ['vps-ssh-key']) {
          withCredentials([string(credentialsId: 'vps-ssh-target', variable: 'VPS_TARGET')]) {
            // Script được pipe qua stdin => VPS chạy đúng bản script của commit này
            sh '''
              set -eu
              ssh -o StrictHostKeyChecking=accept-new "$VPS_TARGET" "bash -s -- deploy $GIT_SHA" < deploy/remote-deploy.sh
            '''
          }
        }
        script { env.DEPLOYED = 'true' }
      }
    }

    stage('Smoke test') {
      // Kiểm qua đường public (Nginx + SSL), khác với health check nội bộ trong remote-deploy.sh:
      // bắt được cả trường hợp container xanh nhưng Nginx/cert hỏng.
      steps {
        sh '''
          set -eu
          for i in $(seq 1 10); do
            body=$(curl -fsS --max-time 10 "$HEALTH_URL" || true)
            # Không dùng backslash trong regex sed: Groovy nuốt escape của chuỗi shell
            # trước khi shell nhìn thấy, nên cắt hai đầu bằng hai lệnh sed là an toàn nhất.
            case "$body" in
              *'"commit":"'*) commit=$(printf '%s' "$body" | sed -e 's/.*"commit":"//' -e 's/".*//') ;;
              *) commit="" ;;
            esac
            if [ "$commit" = "$GIT_SHA" ]; then
              echo "smoke OK: $body"
              exit 0
            fi
            echo "lần $i: commit=${commit:-none}, chờ $GIT_SHA"
            sleep 3
          done
          echo "smoke test thất bại — public health không trả commit $GIT_SHA" >&2
          exit 1
        '''
      }
    }
  }

  post {
    failure {
      script {
        // Chỉ rollback khi đã thực sự đổi thứ đang chạy; fail ở stage Test thì không đụng VPS
        if (env.DEPLOYED == 'true') {
          sshagent(credentials: ['vps-ssh-key']) {
            withCredentials([string(credentialsId: 'vps-ssh-target', variable: 'VPS_TARGET')]) {
              sh '''
                set +e
                ssh -o StrictHostKeyChecking=accept-new "$VPS_TARGET" "bash -s -- rollback" < deploy/remote-deploy.sh
              '''
            }
          }
          notify("🔴 hangil-server ${env.GIT_SHA} deploy HỎNG — đã rollback. Build #${env.BUILD_NUMBER}")
        } else {
          notify("🔴 hangil-server build #${env.BUILD_NUMBER} fail (${env.GIT_SHA ?: 'chưa checkout'}) — VPS không đổi")
        }
      }
    }
    success {
      script {
        if (env.DEPLOYED == 'true') {
          notify("🟢 hangil-server ${env.GIT_SHA} đã lên production. Build #${env.BUILD_NUMBER}")
        }
      }
    }
    // `cleanup` chạy SAU cùng. Dùng `always` ở đây là bug: nó chạy trước khối `failure`,
    // xoá mất deploy/remote-deploy.sh mà bước rollback đang cần.
    cleanup { cleanWs() }
  }
}

// Telegram là tuỳ chọn — thiếu credential thì bỏ qua, không được làm fail build vì chuyện báo tin.
void notify(String message) {
  try {
    withCredentials([string(credentialsId: 'telegram-bot-token', variable: 'TG_TOKEN'),
                     string(credentialsId: 'telegram-chat-id',   variable: 'TG_CHAT')]) {
      withEnv(["TG_MESSAGE=${message}"]) {
        sh '''
          curl -fsS -X POST "https://api.telegram.org/bot$TG_TOKEN/sendMessage" --data-urlencode "chat_id=$TG_CHAT" --data-urlencode "text=$TG_MESSAGE" >/dev/null || true
        '''
      }
    }
  } catch (ignored) {
    echo "Bỏ qua thông báo Telegram: chưa cấu hình credential"
  }
}
