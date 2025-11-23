@echo off
echo Starting Chrome with remote debugging on port 9222...
echo Keep this Chrome window open while running your analysis!
echo.
start chrome.exe --remote-debugging-port=9222
echo.
echo Chrome started! Make sure to add this to your .env file:
echo CHROME_REMOTE_DEBUG_PORT=9222
echo.
pause

