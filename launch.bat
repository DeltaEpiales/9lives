@echo off
rem Launch script for Windows

echo Starting local server at http://localhost:8000
echo Your website will be available shortly.
echo Press CTRL+C to stop the server.

rem Start Python's built-in HTTP server
python -m http.server 3500