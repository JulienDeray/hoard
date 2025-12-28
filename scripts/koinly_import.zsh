#!/bin/zsh

output=$(awk '
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]+, [0-9]{4}$/ { print }
  /^[A-Z]{3,5}$/ {
    ticker = $0
    getline; amount = $0
    getline  # skip first value
    getline  # skip first € / unit
    getline  # skip second value
    getline  # this is the second € / unit
    print ticker
    print amount
    print $0
  }
')

date_line=$(echo "$output" | head -1)
month=$(echo "$date_line" | awk '{print $1}')
year=$(echo "$date_line" | awk '{print $3}')

month_num=$(printf "%02d" $(echo "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec" | tr ' ' '\n' | grep -n "^$month$" | cut -d: -f1))

filename="koinly-${year}-${month_num}.txt"

echo "$output"
echo "$output" > "$filename"

echo "\n→ Saved to $filename"