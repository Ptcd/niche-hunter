# 🔄 Restart Next.js Server to Fix Chrome Issue

## Why Restart?
The code was updated to use 45 seconds instead of 15, but the running server still has the old code loaded.

## Steps:

1. **Find the terminal/window where `npm run dev` is running**
   - Look for a window showing `next dev` or `localhost:3000`
   
2. **Stop the server:**
   - Press `Ctrl + C` in that terminal
   - Wait for it to stop

3. **Close ALL Chrome windows:**
   - Close every Chrome window/tab
   - Wait 5 seconds

4. **Restart the server:**
   ```bash
   cd apps/web
   npm run dev
   ```

5. **Start a new analysis in Firefox**

The server should now use the 45-second timeout and Chrome should connect properly!

