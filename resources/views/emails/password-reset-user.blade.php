@component('mail::message')
# Reset Your Password

Hi **{{ $userName }}**,

You requested a password reset for your StudyHub account. Click the button below to set a new password. This link expires in **60 minutes**.

@component('mail::button', ['url' => $resetUrl, 'color' => 'primary'])
Reset Password
@endcomponent

If you did not request a password reset, no action is needed — your password will remain unchanged.

Thanks,
**The StudyHub Team**
@endcomponent
