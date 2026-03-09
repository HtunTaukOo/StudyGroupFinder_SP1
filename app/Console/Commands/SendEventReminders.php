<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Event;
use App\Mail\EventReminderMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class SendEventReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'events:send-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send reminder emails for events happening tomorrow';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info('Checking for events happening tomorrow...');

        // Get tomorrow's date
        $tomorrow = Carbon::tomorrow();

        // Find all events happening tomorrow that have a group_id
        $events = Event::whereNotNull('group_id')
            ->whereDate('start_time', $tomorrow)
            ->with('group.members')
            ->get();

        if ($events->isEmpty()) {
            $this->info('No events found for tomorrow.');
            return 0;
        }

        $this->info("Found {$events->count()} event(s) happening tomorrow.");

        $emailsSent = 0;
        $emailsFailed = 0;

        foreach ($events as $event) {
            if (!$event->group) {
                continue;
            }

            $group = $event->group;
            $members = $group->members;

            if ($members->isEmpty()) {
                continue;
            }

            $eventTime = Carbon::parse($event->start_time)->format('l, F j, Y \a\t g:i A');

            $this->info("Processing event: {$event->title} for group: {$group->name}");

            foreach ($members as $member) {
                // Only send to verified email addresses
                if (!$member->email_verified_at) {
                    continue;
                }

                try {
                    Mail::to($member->email)->queue(new EventReminderMail(
                        $member->name,
                        $group->name,
                        $event->title,
                        $eventTime,
                        $event->location
                    ));

                    $emailsSent++;
                    $this->info("  ✓ Sent reminder to {$member->email}");
                } catch (\Exception $e) {
                    $emailsFailed++;
                    $this->error("  ✗ Failed to send to {$member->email}: {$e->getMessage()}");
                    Log::error("Failed to send event reminder email to {$member->email}: " . $e->getMessage());
                }
            }
        }

        $this->info("\nSummary:");
        $this->info("Events processed: {$events->count()}");
        $this->info("Emails sent: {$emailsSent}");
        if ($emailsFailed > 0) {
            $this->warn("Emails failed: {$emailsFailed}");
        }

        return 0;
    }
}
