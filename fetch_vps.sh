#!/bin/bash

PASS="Sanchit@282930"
DEST="output/export/2026-08-10-round-2/"

rm -f "$DEST"/*.json

for ip in 163.245.196.45 153.75.235.158 163.245.196.35 162.35.163.93 153.75.235.165; do
  echo "Fetching from $ip..."
  expect -c "
    set timeout -1
    spawn scp -o StrictHostKeyChecking=no root@$ip:~/book_listing_automator/output/amazon-search-term/chunks-chunk-?-stage-1.json $DEST
    expect {
      \"*assword:*\" {
        send \"$PASS\r\"
        exp_continue
      }
      eof
    }
  "
done
