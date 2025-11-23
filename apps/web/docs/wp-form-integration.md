# WordPress Form Integration

## Setup

Add to your WP plugin's form handler:

```php
// After form validation
$response = wp_remote_post('https://your-app.vercel.app/api/webhooks/lead', [
    'body' => json_encode([
        'siteId' => get_option('nichehunter_site_id'),
        'type' => 'FORM',
        'contactName' => sanitize_text_field($_POST['name']),
        'contactEmail' => sanitize_email($_POST['email']),
        'contactPhone' => sanitize_text_field($_POST['phone']),
        'message' => sanitize_textarea_field($_POST['message']),
        'source' => 'contact_form',
    ]),
    'headers' => [
        'Content-Type' => 'application/json',
    ],
]);
```

## Environment Variable

Set in WP plugin:

- `NICHEHUNTER_WEBHOOK_URL` = https://your-app.vercel.app/api/webhooks/lead

