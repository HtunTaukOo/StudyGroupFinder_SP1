<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\StudyGroupController;
use App\Http\Controllers\API\MessageController;
use App\Http\Controllers\API\FeedbackController;
use App\Http\Controllers\API\DiscoverController;
use App\Http\Controllers\API\CalendarController;
use App\Http\Controllers\API\ProfileController;
use App\Http\Controllers\API\NotificationController;
use App\Http\Controllers\API\AdminController;
use App\Http\Controllers\API\RatingController;
use App\Http\Controllers\API\ReportsController;
use App\Http\Controllers\API\LeaderRequestController;

// Auth
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// Email Verification (public route for clicking email link)
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])->name('verification.verify');

Route::middleware(['auth:sanctum', \App\Http\Middleware\SuspendedUserMiddleware::class])->group(function () {
    // Admin Notifications (requires authentication)
    Route::middleware('admin')->group(function () {
        Route::get('/admin/notifications', [AdminController::class, 'getNotifications']);
        Route::get('/admin/notifications/unread-count', [AdminController::class, 'getUnreadCount']);
        Route::post('/admin/notifications/mark-read', [AdminController::class, 'markNotificationsAsRead']);
    });
    Route::post('/logout', [AuthController::class, 'logout']);

    // Email Verification (authenticated routes)
    Route::post('/email/resend', [AuthController::class, 'resendVerification']);
    Route::get('/email/verification-status', [AuthController::class, 'checkVerificationStatus']);

    // Groups
    Route::apiResource('groups', StudyGroupController::class);
    Route::post('/groups/{id}/join', [StudyGroupController::class, 'join']);
    Route::post('/groups/{id}/leave', [StudyGroupController::class, 'leave']);
    Route::get('/groups/{id}/members', [StudyGroupController::class, 'getMembers']);
    Route::get('/groups/{id}/pending-requests', [StudyGroupController::class, 'pendingRequests']);
    Route::post('/groups/{groupId}/approve/{userId}', [StudyGroupController::class, 'approveRequest']);
    Route::post('/groups/{groupId}/reject/{userId}', [StudyGroupController::class, 'rejectRequest']);
    Route::post('/groups/{groupId}/kick/{userId}', [StudyGroupController::class, 'kickMember']);

    // Group invitations
    Route::post('/groups/{groupId}/invite', [StudyGroupController::class, 'inviteMember']);
    Route::post('/groups/{groupId}/invitation/accept', [StudyGroupController::class, 'acceptInvitation']);
    Route::post('/groups/{groupId}/invitation/decline', [StudyGroupController::class, 'declineInvitation']);
    Route::get('/groups/{groupId}/invitations', [StudyGroupController::class, 'getInvitedUsers']);

    // Ratings
    Route::post('/groups/{groupId}/rate', [RatingController::class, 'store']);
    Route::delete('/groups/{groupId}/rate', [RatingController::class, 'destroy']);
    Route::get('/groups/{groupId}/my-rating', [RatingController::class, 'show']);

    // Chat
    Route::get('/groups/{id}/messages', [MessageController::class, 'index']);
    Route::post('/groups/{id}/messages', [MessageController::class, 'store']);

    // Discover
    Route::get('/discover/trending', [DiscoverController::class, 'trending']);
    Route::get('/discover/subjects', [DiscoverController::class, 'subjects']);
    Route::get('/discover/leaders', [DiscoverController::class, 'leaders']);
    Route::get('/discover/users/search', [DiscoverController::class, 'searchUsers']);

    // Feedback
    Route::get('/feedback', [FeedbackController::class, 'index']);
    Route::post('/feedback', [FeedbackController::class, 'store']);

    // Reports (user-facing)
    Route::post('/reports', [ReportsController::class, 'store']);
    Route::get('/reports/my-reports', [ReportsController::class, 'myReports']);

    // Leader Requests (user-facing)
    Route::post('/leader-requests', [LeaderRequestController::class, 'store']);
    Route::get('/leader-requests/my-status', [LeaderRequestController::class, 'myStatus']);

    // Calendar
    Route::get('/calendar/events', [CalendarController::class, 'index']);
    Route::post('/calendar/events', [CalendarController::class, 'store']);
    Route::put('/calendar/events/{id}', [CalendarController::class, 'update']);
    Route::delete('/calendar/events/{id}', [CalendarController::class, 'destroy']);

    // Profile
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::post('/profile/change-password', [ProfileController::class, 'changePassword']);
    Route::get('/profile/stats', [ProfileController::class, 'stats']);
    Route::get('/profile/details', [ProfileController::class, 'details']);

    // Privacy
    Route::put('/profile/privacy', [ProfileController::class, 'updatePrivacy']);
    Route::delete('/profile', [ProfileController::class, 'deleteAccount']);

    // User Profiles (view other users)
    Route::get('/users/{id}', [ProfileController::class, 'showUser']);
    Route::get('/users/{id}/stats', [ProfileController::class, 'userStats']);
    Route::get('/users/{id}/details', [ProfileController::class, 'userDetails']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/mark-read', [NotificationController::class, 'markAsRead']);

    // Admin Routes (requires admin middleware)
    Route::middleware('admin')->prefix('admin')->group(function () {
        // Dashboard
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/system-overview', [AdminController::class, 'getSystemOverview']);
        Route::get('/analytics', [AdminController::class, 'getAnalytics']);
        Route::get('/moderation-activity', [AdminController::class, 'getModerationActivity']);

        // User Management
        Route::get('/users', [AdminController::class, 'getUsers']);
        Route::get('/users/{id}/profile', [AdminController::class, 'getUserProfile']);
        Route::put('/users/{id}', [AdminController::class, 'updateUser']);
        Route::post('/users/{id}/assign-role', [AdminController::class, 'assignRole']);
        Route::post('/users/{id}/suspend', [AdminController::class, 'suspendUser']);
        Route::post('/users/{id}/reset-password', [AdminController::class, 'resetPassword']);
        Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);

        // Group Management
        Route::get('/groups', [AdminController::class, 'getGroups']);
        Route::put('/groups/{id}', [AdminController::class, 'updateGroup']);
        Route::post('/groups/{id}/transfer-ownership', [StudyGroupController::class, 'transferOwnership']);
        Route::post('/groups/{id}/approve', [AdminController::class, 'approveGroup']);
        Route::post('/groups/{id}/reject', [AdminController::class, 'rejectGroup']);
        Route::post('/groups/{id}/force-archive', [StudyGroupController::class, 'forceArchive']);
        Route::get('/groups/{id}/chat-logs', [StudyGroupController::class, 'getChatLogs']);
        Route::delete('/groups/{id}', [AdminController::class, 'deleteGroup']);

        // Reports Management
        Route::get('/reports', [ReportsController::class, 'index']);
        Route::get('/reports/statistics', [ReportsController::class, 'statistics']);
        Route::get('/reports/{id}', [ReportsController::class, 'show']);
        Route::post('/reports/{id}/update-priority', [ReportsController::class, 'updatePriority']);
        Route::post('/reports/{id}/resolve', [ReportsController::class, 'resolve']);

        // Feedback Management
        Route::get('/feedback', [AdminController::class, 'getFeedback']);
        Route::delete('/feedback/{id}', [AdminController::class, 'deleteFeedback']);

        // User Moderation (Warn/Ban)
        Route::post('/users/{id}/warn', [AdminController::class, 'warnUser']);
        Route::post('/users/{id}/ban', [AdminController::class, 'banUser']);
        Route::post('/users/{id}/unban', [AdminController::class, 'unbanUser']);
        Route::post('/users/{id}/unsuspend', [AdminController::class, 'unsuspendUser']);

        // Events Management
        Route::get('/events', [AdminController::class, 'getEvents']);
        Route::put('/events/{id}', [AdminController::class, 'updateEvent']);
        Route::delete('/events/{id}', [AdminController::class, 'deleteEvent']);

        // Ratings Management
        Route::get('/ratings', [AdminController::class, 'getRatings']);
        Route::delete('/ratings/{id}', [AdminController::class, 'deleteRating']);

        // Leader Requests Management
        Route::get('/leader-requests', [AdminController::class, 'getLeaderRequests']);
        Route::post('/leader-requests/{id}/approve', [AdminController::class, 'approveLeaderRequest']);
        Route::post('/leader-requests/{id}/reject', [AdminController::class, 'rejectLeaderRequest']);
    });
});