#!/bin/bash
mkdir -p output/export/amazon-round-2-unique

for file in output/export/amazon-round-1/*.json; do
  filename=$(basename "$file")
  round2_file="output/export/amazon-round-2/$filename"
  unique_file="output/export/amazon-round-2-unique/$filename"
  
  if [ -f "$round2_file" ]; then
    lines_round1=$(wc -l < "$file" | tr -d ' ')
    lines_round2=$(wc -l < "$round2_file" | tr -d ' ')
    new_lines=$((lines_round2 - lines_round1))
    
    if [ "$new_lines" -gt 0 ]; then
      echo "$filename: $lines_round1 in R1, $lines_round2 in R2. Extracting $new_lines new lines."
      tail -n "$new_lines" "$round2_file" > "$unique_file"
    else
      echo "$filename: No new lines."
    fi
  else
    echo "Warning: $round2_file not found."
  fi
done
