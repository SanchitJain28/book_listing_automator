#!/bin/bash

PASS="Sanchit@282930"
DEST="output/amazon-india/search-term/stage-2/2026-08-10/chunks"
mkdir -p "$DEST"

IPS=("162.35.163.93" "153.75.235.165" "163.245.196.45" "153.75.235.158" "163.245.196.35")

for ip in "${IPS[@]}"; do
  echo "📥 Fetching from $ip..."
  sshpass -p "$PASS" scp -o StrictHostKeyChecking=no "root@$ip:~/book_listing_automator/$DEST/*.json" "$DEST/" || echo "⚠️ Failed to fetch from $ip"
done

echo "✅ All chunks fetched into $DEST"

