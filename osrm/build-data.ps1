# Build dữ liệu định tuyến OSRM cho Việt Nam — CHẠY 1 LẦN trên máy dev (không
# chạy trong lúc Railway build image, xem ghi chú trong Dockerfile cùng thư
# mục). Yêu cầu Docker Desktop đang chạy. Kết quả là các file *.osrm* trong
# thư mục hiện tại — nén lại và upload làm GitHub Release asset, rồi trỏ
# osrm/Dockerfile (ARG OSRM_DATA_URL) sang link đó.
#
# Chạy lại script này khi cần cập nhật bản đồ (đường mới mở, v.v.) — dữ liệu
# OpenStreetMap không tự cập nhật.

$ErrorActionPreference = 'Stop'
$dataDir = $PSScriptRoot

Write-Host "1/4 - Tải bản đồ Việt Nam từ Geofabrik (~200MB)..."
Invoke-WebRequest -Uri 'https://download.geofabrik.de/asia/vietnam-latest.osm.pbf' -OutFile (Join-Path $dataDir 'vietnam-latest.osm.pbf')

Write-Host "2/4 - osrm-extract (bóc tách mạng lưới đường bộ)..."
docker run --rm -v "${dataDir}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/vietnam-latest.osm.pbf

Write-Host "3/4 - osrm-partition (phân vùng cho thuật toán MLD)..."
docker run --rm -v "${dataDir}:/data" osrm/osrm-backend osrm-partition /data/vietnam-latest.osrm

Write-Host "4/4 - osrm-contract (rút gọn đồ thị định tuyến)..."
docker run --rm -v "${dataDir}:/data" osrm/osrm-backend osrm-customize /data/vietnam-latest.osrm

Write-Host ""
Write-Host "Xong. Nén toàn bộ file 'vietnam-latest.osrm*' thành 1 file zip, ví dụ:"
Write-Host "  Compress-Archive -Path '$dataDir\vietnam-latest.osrm*' -DestinationPath '$dataDir\vietnam-latest.osrm.zip'"
Write-Host "Rồi upload file zip đó làm GitHub Release asset và cập nhật OSRM_DATA_URL trong osrm/Dockerfile."
