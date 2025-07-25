#!/bin/bash
# Launch script for macOS and Linux
PORT=8000
while lsof -i :$PORT > /dev/null; do
    echo "Port $PORT is in use, trying next port..."
    PORT=$((PORT + 1))
done
echo ""
echo "================================================="
echo "🚀 Starting local server..."
echo "✅ Your website is available at: http://localhost:$PORT"
echo "================================================="
echo "Press CTRL+C to stop the server."
echo ""
python3 -m http.server $PORT