<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class GroupJoinNotification extends Mailable
{
    use Queueable, SerializesModels;

    public $userName;
    public $groupName;
    public $groupId;

    /**
     * Create a new message instance.
     */
    public function __construct($userName, $groupName, $groupId)
    {
        $this->userName = $userName;
        $this->groupName = $groupName;
        $this->groupId = $groupId;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'New Member Joined ' . $this->groupName,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            markdown: 'emails.group-join',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
