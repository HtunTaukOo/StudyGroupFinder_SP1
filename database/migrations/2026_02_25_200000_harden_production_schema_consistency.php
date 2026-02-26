<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $this->syncLegacyFeedbacks();
        $this->ensureModerationLogIndexes();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-destructive hardening migration: no rollback action.
    }

    private function syncLegacyFeedbacks(): void
    {
        if (!Schema::hasTable('feedbacks') || !Schema::hasTable('feedback')) {
            return;
        }

        $requiredFeedbackColumns = ['id', 'user_id', 'rating', 'comment', 'created_at', 'updated_at', 'group_name'];
        foreach ($requiredFeedbackColumns as $column) {
            if (!Schema::hasColumn('feedback', $column)) {
                return;
            }
        }

        $requiredLegacyColumns = ['id', 'user_id', 'rating', 'text', 'created_at', 'updated_at', 'group_name'];
        foreach ($requiredLegacyColumns as $column) {
            if (!Schema::hasColumn('feedbacks', $column)) {
                return;
            }
        }

        DB::table('feedbacks')
            ->orderBy('id')
            ->chunkById(500, function ($rows): void {
                foreach ($rows as $row) {
                    DB::table('feedback')->updateOrInsert(
                        ['id' => $row->id],
                        [
                            'user_id' => $row->user_id,
                            'group_name' => $row->group_name,
                            'rating' => $row->rating,
                            'comment' => $row->text,
                            'created_at' => $row->created_at,
                            'updated_at' => $row->updated_at,
                        ]
                    );
                }
            }, 'id');
    }

    private function ensureModerationLogIndexes(): void
    {
        if (!Schema::hasTable('moderation_logs')) {
            return;
        }

        // 2026_02_16 migration recreates moderation_logs and can drop previously-added indexes.
        $this->createIndexIfMissing('moderation_logs', 'idx_moderation_logs_moderator_id', 'moderator_id');
        $this->createIndexIfMissing('moderation_logs', 'idx_moderation_logs_target_user_id', 'target_user_id');
        $this->createIndexIfMissing('moderation_logs', 'idx_moderation_logs_action_type', 'action_type');
        $this->createIndexIfMissing('moderation_logs', 'idx_moderation_logs_created_at', 'created_at');
    }

    private function createIndexIfMissing(string $table, string $indexName, string $column): void
    {
        $driver = DB::getDriverName();

        if (in_array($driver, ['pgsql', 'sqlite'])) {
            DB::statement("CREATE INDEX IF NOT EXISTS {$indexName} ON {$table} ({$column})");
            return;
        }

        if ($driver === 'mysql') {
            $existing = DB::select('SHOW INDEX FROM ' . $table . ' WHERE Key_name = ?', [$indexName]);
            if (empty($existing)) {
                DB::statement("CREATE INDEX {$indexName} ON {$table} ({$column})");
            }
            return;
        }

        // Fallback for other drivers: try and ignore duplicate index errors.
        try {
            Schema::table($table, function (Blueprint $tableBlueprint) use ($column, $indexName) {
                $tableBlueprint->index($column, $indexName);
            });
        } catch (\Throwable $e) {
            // no-op
        }
    }
};
