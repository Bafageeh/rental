<?php

// Standalone verification uses only an in-memory database and fake outbound HTTP.
chdir($argv[1] ?? dirname(__DIR__));
require 'vendor/autoload.php';
if (isset($argv[2])) {
    require $argv[2].'/app/Services/IncomingWhatsAppForwardingService.php';
    require $argv[2].'/app/Http/Middleware/ForwardIncomingWhatsAppMessages.php';
}
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Http\Middleware\ForwardIncomingWhatsAppMessages;
use App\Models\WebhookEvent;
use App\Services\IncomingWhatsAppForwardingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

config([
    'database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
    'cache.default' => 'array', 'services.whatsapp.access_token' => 'fake_token',
    'services.whatsapp.phone_number_id' => 'test_phone_id', 'services.whatsapp.app_secret' => 'test_secret',
    'whatsapp-forwarding.enabled' => true, 'whatsapp-forwarding.recipient' => '0500007650',
    'whatsapp-forwarding.template' => 'incoming_whatsapp_message_alert_ar',
    'whatsapp-forwarding.language' => 'ar', 'whatsapp-forwarding.api_version' => 'v25.0',
]);
DB::purge('sqlite');
Schema::create('webhook_events', function ($table) {
    $table->id();
    foreach (['provider','event_type','direction','external_id','source','destination','status'] as $column) {
        $table->string($column)->nullable();
    }
    $table->unsignedBigInteger('tenant_id')->nullable();
    $table->text('payload')->nullable();
    $table->timestamp('processed_at')->nullable();
    $table->timestamps();
});

$checks = [];
$check = function (bool $condition, string $name) use (&$checks) {
    if (!$condition) throw new RuntimeException('FAILED: '.$name);
    $checks[] = $name;
};
$sent = [];
$messageCounter = 0;
$resetHttp = function (?Closure $responder = null) use (&$sent, &$messageCounter) {
    $sent = [];
    Http::swap(new Illuminate\Http\Client\Factory());
    Http::preventStrayRequests();
    Http::fake(function ($request) use (&$sent, &$messageCounter, $responder) {
        $sent[] = $request->data();
        return $responder ? $responder(count($sent)) : Http::response(['messages' => [['id' => 'fake_'.(++$messageCounter)]]], 200);
    });
};
$service = app(IncomingWhatsAppForwardingService::class);
$message = fn (string $id, string $text, string $from = '966500000001') => [
    'id' => $id, 'from' => $from, 'type' => 'text', 'timestamp' => (string) time(), 'text' => ['body' => $text],
];
$metadata = ['phone_number_id' => 'test_phone_id'];

$resetHttp();
$sample = $message('test_a', "السلام عليكم\nأرجو التواصل معي 🙂");
$result = $service->forward($sample, $metadata);
$check($result['ok'] && count($sent) === 1, 'Immediate forwarding succeeds');
$check($sent[0]['to'] === '966500007650', 'Exact requested recipient is normalized');
$check($sent[0]['type'] === 'template'
    && $sent[0]['template']['components'][0]['parameters'][0]['text'] === '+966500000001'
    && $sent[0]['template']['components'][0]['parameters'][1]['text'] === 'السلام عليكم أرجو التواصل معي 🙂',
    'Closed service window uses template with sender and complete Unicode text');
$service->forward($sample, $metadata);
$check(count($sent) === 1, 'Webhook redelivery does not send a duplicate');

$request = function (array $value, bool $validSignature = true) {
    $body = json_encode(['object' => 'whatsapp_business_account', 'entry' => [['changes' => [['field' => 'messages', 'value' => $value]]]]]);
    return Request::create('/api/wa/webhook', 'POST', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_HUB_SIGNATURE_256' => $validSignature ? 'sha256='.hash_hmac('sha256', $body, 'test_secret') : 'sha256=invalid',
    ], $body);
};
$middleware = app(ForwardIncomingWhatsAppMessages::class);
$resetHttp();
$next = fn ($request) => response()->json(['next' => 'wasl_router']);
$response = $middleware->handle($request(['metadata' => $metadata, 'messages' => [$message('wasl_test', 'وصل')]]), $next);
$check(count($sent) === 1 && $response->getData(true)['next'] === 'wasl_router',
    'Forwarding runs before another router consumes an incoming message');
$resetHttp();
$middleware->handle($request(['metadata' => $metadata, 'statuses' => [['id' => 'outgoing_id', 'status' => 'delivered']]]), $next);
$check(count($sent) === 0, 'Outgoing delivery receipts do not create forwarding loops');
$response = $middleware->handle($request(['metadata' => $metadata, 'messages' => [$message('bad_signature', 'test')]], false), $next);
$check($response->getStatusCode() === 403 && count($sent) === 0, 'Invalid signatures never trigger forwarding');
$middleware->handle($request(['metadata' => ['phone_number_id' => 'other_id'], 'messages' => [$message('other_account', 'test')]]), $next);
$check(count($sent) === 0, 'Messages belonging to another business number are skipped');

$resetHttp();
$service->forward($message('own_test', 'تجربة', '0500007650'), $metadata);
$service->forward($message('window_test', "رسالة\nبسطرين", '0500000001'), $metadata);
$check($sent[1]['type'] === 'text' && str_contains($sent[1]['text']['body'], "رسالة\nبسطرين"),
    'An open service window preserves original text formatting');
$check(str_contains($sent[1]['text']['body'], '+966500000001'), 'Local sender numbers are normalized');

Cache::forget('incoming-whatsapp-admin-window-966500007650');
$resetHttp();
$longText = str_repeat('أ', 1500);
$longMessage = $message('long_test', $longText);
$longResult = $service->forward($longMessage, $metadata);
$joined = '';
foreach ($sent as $body) {
    $joined .= preg_replace('/^\[الجزء \d+ من \d+\] /u', '', $body['template']['components'][0]['parameters'][1]['text']);
}
$check(count($sent) === 3 && $joined === $longText, 'Long messages are forwarded in full across bounded template parts');

$longEvent = WebhookEvent::findOrFail($longResult['event_id']);
$failedId = $longEvent->payload['provider_message_ids'][1];
$service->recordDeliveryStatus(['id' => $failedId, 'status' => 'failed', 'errors' => [['code' => 131047]]]);
$check($longEvent->fresh()->status === 'failed' && $longEvent->fresh()->payload['parts_sent'] === 2,
    'Asynchronous delivery failure is persisted for retry');
$resetHttp();
$service->forward($longMessage, $metadata);
$check(count($sent) === 1 && $longEvent->fresh()->status === 'sent',
    'Asynchronous retry sends only the failed part');
$service->recordDeliveryStatus(['id' => $failedId, 'status' => 'failed']);
$check($longEvent->fresh()->status === 'sent', 'An obsolete delivery failure cannot reset a successful retry');

$resetHttp(fn ($index) => $index === 2
    ? Http::response(['error' => ['code' => 1, 'message' => 'Temporary failure']], 503)
    : Http::response(['messages' => [['id' => 'partial_'.$index]]], 200));
$retryMessage = $message('retry_test', $longText);
$result = $service->forward($retryMessage, $metadata);
$check(!$result['ok'] && WebhookEvent::where('status', 'failed')->count() === 1,
    'Failed sends are persisted for automatic retry');
$resetHttp();
$result = $service->forward($retryMessage, $metadata);
$check($result['ok'] && count($sent) === 2 && $result['parts_sent'] === 3,
    'Retry resumes remaining parts without repeating successful ones');

$resetHttp();
$service->forward(['id' => 'caption_test', 'from' => '966500000002', 'type' => 'image', 'image' => ['caption' => 'نص الصورة']], $metadata);
$check($sent[0]['template']['components'][0]['parameters'][1]['text'] === 'نص الصورة', 'Image captions are forwarded');

config(['whatsapp-forwarding.enabled' => false]);
$resetHttp();
$result = $service->forward($message('disabled_test', 'test'), $metadata);
$check(count($sent) === 0 && ($result['skipped'] ?? '') === 'disabled', 'Disabled forwarding does not send');

echo json_encode(['passed' => count($checks), 'checks' => $checks], JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE), PHP_EOL;
