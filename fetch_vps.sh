#!/bin/bash

PASS="Sanchit@282930"
DEST="output/amazon-india/search-term/stage-2/2026-08-10/chunks"
mkdir -p "$DEST"

IPS=("216.219.85.173" "69.164.249.174" "69.164.244.21" "162.35.176.48" "69.169.103.19")

for ip in "${IPS[@]}"; do
  echo "📥 Fetching from $ip..."
  sshpass -p "$PASS" scp -o StrictHostKeyChecking=no "root@$ip:~/book_listing_automator/$DEST/*.json" "$DEST/" || echo "⚠️ Failed to fetch from $ip"
done

echo "✅ All chunks fetched into $DEST"

