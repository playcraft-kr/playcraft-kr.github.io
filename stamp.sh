#!/bin/bash
# Give app.css / app.js / account.js a new version tag so browsers fetch the fresh files after every change.
cd "$(dirname "$0")/preview" || exit 1
v=$(date +%Y%m%d%H%M%S)
sed -i '' -E "s/(app\.css|app\.js|account\.js)(\?v=[0-9]+)?\"/\1?v=$v\"/g" index.html
grep -oE '(app\.css|app\.js|account\.js)\?v=[0-9]+' index.html
