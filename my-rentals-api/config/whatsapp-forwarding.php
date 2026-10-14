<?php

return [
    'enabled' => env('WHATSAPP_INCOMING_FORWARD_ENABLED', false),
    'recipient' => env('WHATSAPP_INCOMING_FORWARD_TO', ''),
    'template' => env('WHATSAPP_INCOMING_FORWARD_TEMPLATE', 'incoming_whatsapp_message_alert_ar'),
    'language' => env('WHATSAPP_INCOMING_FORWARD_LANGUAGE', 'ar'),
    'api_version' => env('WHATSAPP_API_VERSION', env('WHATSAPP_GRAPH_VERSION', 'v25.0')),
];
