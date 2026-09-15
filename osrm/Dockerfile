FROM osrm/osrm-backend:latest

# Bộ file .osrm đã được build sẵn 1 lần trên máy dev (xem build-data.ps1 cùng
# thư mục) — KHÔNG build osrm-extract/partition/contract trong lúc Railway
# build image này, vì bước đó rất tốn RAM/thời gian và không cần thiết phải
# lặp lại ở mỗi lần deploy. Sau khi build xong, nén thành zip và upload làm
# GitHub Release asset, rồi thay URL bên dưới (qua Railway Variables khi tạo
# service, hoặc sửa trực tiếp giá trị mặc định này).
ARG OSRM_DATA_URL=https://github.com/<your-username>/<your-repo>/releases/download/osrm-data-v1/vietnam-latest.osrm.zip

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /data
RUN curl -fL "$OSRM_DATA_URL" -o data.zip \
    && unzip data.zip \
    && rm data.zip

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/entrypoint.sh"]
