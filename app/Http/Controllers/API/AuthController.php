<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Mail\EmailVerificationMail;
use App\Mail\PasswordResetMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const DASHBOARD_CACHE_KEY = 'admin_dashboard_stats_v2';
    private const ANALYTICS_CACHE_KEY_PREFIX = 'admin_analytics_v2_';

    private function clearAdminCaches(): void
    {
        // Current cache keys
        Cache::forget(self::DASHBOARD_CACHE_KEY);
        Cache::forget(self::ANALYTICS_CACHE_KEY_PREFIX . 'daily');
        Cache::forget(self::ANALYTICS_CACHE_KEY_PREFIX . 'weekly');
        Cache::forget(self::ANALYTICS_CACHE_KEY_PREFIX . 'monthly');

        // Legacy cache keys
        Cache::forget('admin_dashboard_stats');
        Cache::forget('admin_analytics_daily');
        Cache::forget('admin_analytics_weekly');
        Cache::forget('admin_analytics_monthly');
    }

    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'major' => 'nullable|string|max:255',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'major' => $request->major,
            'role' => 'member', // Default role for all new users
        ]);

        $this->clearAdminCaches();

        // Require email verification via verification link
        $this->sendVerificationEmail($user);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
            'message' => 'Registration successful. Please check your email to verify your account.',
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Check if user is banned
        if ($user->banned) {
            return response()->json([
                'message' => 'Your account has been banned. Please contact support for assistance.',
                'reason' => $user->banned_reason
            ], 403);
        }

        // Check if user is suspended
        if ($user->suspended_until && now()->lessThan($user->suspended_until)) {
            return response()->json([
                'message' => 'Your account has been suspended until ' . $user->suspended_until->format('F j, Y g:i A'),
                'reason' => $user->suspension_reason,
                'suspended_until' => $user->suspended_until->toIso8601String()
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    /**
     * Send verification email to user
     */
    private function sendVerificationEmail($user)
    {
        $verificationUrl = $this->generateVerificationUrl($user);

        try {
            Mail::to($user->email)->send(new EmailVerificationMail($user->name, $verificationUrl));
        } catch (\Exception $e) {
            \Log::error('Failed to send verification email: ' . $e->getMessage());
        }
    }

    /**
     * Generate signed verification URL
     */
    private function generateVerificationUrl($user)
    {
        return URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->email)]
        );
    }

    /**
     * Verify user's email
     */
    public function verifyEmail(Request $request, $id)
    {
        $user = User::findOrFail($id);

        // Check if URL signature is valid
        if (!$request->hasValidSignature()) {
            return response()->json([
                'message' => 'Invalid or expired verification link.'
            ], 400);
        }

        // Check if email hash matches
        if (sha1($user->email) !== $request->hash) {
            return response()->json([
                'message' => 'Invalid verification link.'
            ], 400);
        }

        // Check if already verified
        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Email already verified.',
                'verified' => true
            ], 200);
        }

        // Mark email as verified
        $user->markEmailAsVerified();

        return response()->json([
            'message' => 'Email verified successfully!',
            'verified' => true
        ], 200);
    }

    /**
     * Resend verification email
     */
    public function resendVerification(Request $request)
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Email already verified.'
            ], 400);
        }

        $this->sendVerificationEmail($user);

        return response()->json([
            'message' => 'Verification email sent successfully.'
        ], 200);
    }

    /**
     * Send password reset link to user's email
     */
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        // Always return success to prevent email enumeration
        if (!$user) {
            return response()->json(['message' => 'If an account with that email exists, a reset link has been sent.']);
        }

        $token = Password::createToken($user);

        $frontendUrl = env('FRONTEND_URL', 'http://localhost:3000/study-group-finder');
        $resetUrl = $frontendUrl . '/#/reset-password?token=' . $token . '&email=' . urlencode($user->email);

        try {
            Mail::to($user->email)->send(new PasswordResetMail($user->name, $resetUrl));
        } catch (\Exception $e) {
            \Log::error('Failed to send password reset email: ' . $e->getMessage());
        }

        return response()->json(['message' => 'If an account with that email exists, a reset link has been sent.']);
    }

    /**
     * Reset password using token from email
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token'                 => 'required',
            'email'                 => 'required|email',
            'password'              => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->password = Hash::make($password);
                $user->save();
                // Revoke all old tokens so old sessions are invalidated
                $user->tokens()->delete();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Password reset successfully. You can now log in.']);
        }

        return response()->json(['message' => 'This reset link is invalid or has expired.'], 422);
    }

    /**
     * Check verification status
     */
    public function checkVerificationStatus(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'verified' => $user->hasVerifiedEmail(),
            'email' => $user->email
        ]);
    }
}
