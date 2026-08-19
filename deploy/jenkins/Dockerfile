# Jenkins controller cho hangil-server, chạy ở MÁY LOCAL (không phải VPS 2GB).
# Image chính thức chỉ có JDK + git; pipeline còn cần docker CLI (build/push image),
# Node 22 (npm ci/build/test) và ssh client (deploy) nên cài thêm ở đây.
FROM jenkins/jenkins:lts-jdk21

USER root

ARG NODE_MAJOR=22

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg openssh-client \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list \
 && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin nodejs \
 && rm -rf /var/lib/apt/lists/*

# Cài sẵn plugin để không phải click qua UI. Jenkins tự kéo thêm dependency.
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

USER jenkins
