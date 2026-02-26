<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $fillable = ['group_id', 'user_id', 'content', 'type', 'file_path', 'file_name', 'file_type', 'file_size'];
    protected $appends = ['user_name'];

    public function user() {
        return $this->belongsTo(User::class);
    }

    public function getUserNameAttribute() {
        return $this->user->name ?? 'User';
    }
}