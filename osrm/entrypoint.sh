#!/bin/sh
# Railway tự inject biến PORT vào container (thường khác 5000 mỗi lần deploy)
# nhưng osrm-routed không tự đọc biến này — phải truyền qua flag -p. Chạy
# "docker run" cục bộ không có PORT thì mặc định về 5000.
# Glob /data/*.osrm giả định /data chỉ chứa đúng 1 bộ dữ liệu đã build.
exec osrm-routed --algorithm mld -p "${PORT:-5000}" /data/*.osrm
