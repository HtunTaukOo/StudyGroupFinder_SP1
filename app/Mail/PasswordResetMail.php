<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public $userName;
    public $resetUrl;

    public function __construct($userName, $resetUrl)
    {
        $this->userName = $userName;
        $this->resetUrl = $resetUrl;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset Your Password - StudyHub',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.password-reset-user',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
