#!/bin/bash
echo "Firebase Service Account JSON dosyasının tam yolunu gir:"
read json_path

if [ ! -f "$json_path" ]; then
  echo "❌ Dosya bulunamadı: $json_path"
  exit 1
fi

echo ""
echo "=== Şu satırları .env.local'e ekle: ==="
echo ""
echo "FIREBASE_CLIENT_EMAIL=$(cat "$json_path" | grep -o '"client_email": "[^"]*' | cut -d'"' -f4)"
echo ""
echo 'FIREBASE_PRIVATE_KEY="'$(cat "$json_path" | grep -o '"private_key": "[^"]*' | cut -d'"' -f4)'"'
echo ""
