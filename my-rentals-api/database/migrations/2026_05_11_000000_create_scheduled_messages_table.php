<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('scheduled_messages')) {
            return;
        }

        Schema::create('scheduled_messages', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('channel')->default('whatsapp');
            $table->string('recipient')->nullable();
            $table->string('command')->nullable();
            $table->string('frequency')->default('daily');
            $table->string('time', 5)->default('18:25');
            $table->string('timezone')->default('Asia/Riyadh');
            $table->string('status')->default('active');
            $table->date('last_sent_date')->nullable();
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_messages');
    }
};
