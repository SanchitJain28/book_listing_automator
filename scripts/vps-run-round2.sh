#!/usr/bin/env bash
set -e

VPS_ID="$1"
if [ -z "$VPS_ID" ]; then
  echo "❌ Error: Please specify VPS ID (e.g. bash scripts/vps-run-round2.sh 4)"
  exit 1
fi

CHUNK_FILE="input-data/amazon-india/isbns/2026-10-20/round-2/chunks/chunk-vps${VPS_ID}.txt"
PROJECT_DIR="/root/book_listing_automator"

cd "$PROJECT_DIR"

if [ ! -f "$CHUNK_FILE" ]; then
  echo "❌ Error: Chunk file not found: $CHUNK_FILE"
  exit 1
fi

LINE_COUNT=$(wc -l < "$CHUNK_FILE" | tr -d ' ')
echo "📄 Found chunk for VPS $VPS_ID: $CHUNK_FILE ($LINE_COUNT ISBNs)"

echo "🛑 Stopping any existing scrape_round2 tmux sessions and processes..."
tmux kill-session -t scrape_round2 2>/dev/null || true
pkill -f "amazon-isbn" 2>/dev/null || true
sleep 1

echo "🚀 Starting scrape_round2 session..."
tmux new-session -d -s scrape_round2 -c "$PROJECT_DIR" "node utils/watcher.js scrapers/amazon-isbn/amazon-isbn.js $CHUNK_FILE --headless"

sleep 3

echo "✅ Active tmux sessions:"
tmux ls || true

echo "📋 Pane Output:"
tmux capture-pane -pt scrape_round2 || true

echo "🎉 Round-2 scraper launched successfully on VPS $VPS_ID!"
