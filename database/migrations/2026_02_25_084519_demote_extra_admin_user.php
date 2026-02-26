<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Demote any admin user that is not the sole StudyHub admin account.
     */
    public function up(): void
    {
        // Safety guard: only enforce this policy when explicitly enabled.
        if (!filter_var(env('ENFORCE_SINGLE_ADMIN', false), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        if (!Schema::hasTable('users')) {
            return;
        }

        DB::table('users')
            ->where('role', 'admin')
            ->where('email', '!=', 'studyhub.studygroupfinder@gmail.com')
            ->update(['role' => 'member']);
    }

    /**
     * Reverse the migration (no-op — we cannot know what the original role was).
     */
    public function down(): void
    {
        //
    }
};
