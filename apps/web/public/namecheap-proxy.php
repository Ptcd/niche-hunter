<?php
/**
 * Namecheap API Proxy
 * 
 * This proxy script runs on a server with a static IP (Cloudways) to forward
 * Namecheap API requests from Vercel (which has dynamic IPs).
 * 
 * INSTALLATION:
 * 1. Upload this file to your Cloudways WordPress site
 * 2. Whitelist your Cloudways server IP in Namecheap API settings
 * 3. Set environment variables in Vercel:
 *    - NAMECHEAP_PROXY_URL = https://your-cloudways-site.com/namecheap-proxy.php
 *    - NAMECHEAP_PROXY_SECRET = (generate a random string)
 *    - NAMECHEAP_API_USER = your Namecheap username
 *    - NAMECHEAP_API_KEY = your Namecheap API key
 *    - NAMECHEAP_CLIENT_IP = your Cloudways server IP
 * 
 * SECURITY:
 * - Only accepts requests with valid X-Proxy-Secret header
 * - Logs all requests for auditing
 */

// ============================================
// CONFIGURATION - Change this secret!
// ============================================
$PROXY_SECRET = 'CHANGE_THIS_TO_A_RANDOM_STRING_123';

// ============================================
// CORS Headers (allow requests from your Vercel app)
// ============================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Proxy-Secret');
header('Content-Type: text/xml; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================
// Security Check
// ============================================
$providedSecret = $_SERVER['HTTP_X_PROXY_SECRET'] ?? '';

if ($providedSecret !== $PROXY_SECRET) {
    http_response_code(401);
    echo '<?xml version="1.0" encoding="utf-8"?><Error>Unauthorized - Invalid proxy secret</Error>';
    
    // Log failed attempt
    error_log("[Namecheap Proxy] Unauthorized request from " . $_SERVER['REMOTE_ADDR']);
    exit;
}

// ============================================
// Only accept POST requests
// ============================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo '<?xml version="1.0" encoding="utf-8"?><Error>Method not allowed</Error>';
    exit;
}

// ============================================
// Get POST data and forward to Namecheap
// ============================================
$postData = file_get_contents('php://input');

if (empty($postData)) {
    http_response_code(400);
    echo '<?xml version="1.0" encoding="utf-8"?><Error>No data provided</Error>';
    exit;
}

// Log the request (remove sensitive data in production)
error_log("[Namecheap Proxy] Request from " . $_SERVER['REMOTE_ADDR'] . " - Command: " . ($_POST['Command'] ?? 'unknown'));

// ============================================
// Forward request to Namecheap API
// ============================================
$namecheapUrl = 'https://api.namecheap.com/xml.response?' . $postData;

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $namecheapUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_FOLLOWLOCATION => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// ============================================
// Handle errors
// ============================================
if ($error) {
    http_response_code(502);
    echo '<?xml version="1.0" encoding="utf-8"?><Error>Proxy error: ' . htmlspecialchars($error) . '</Error>';
    error_log("[Namecheap Proxy] cURL error: " . $error);
    exit;
}

// ============================================
// Return Namecheap response
// ============================================
http_response_code($httpCode);
echo $response;

// Log success
error_log("[Namecheap Proxy] Success - HTTP " . $httpCode);

