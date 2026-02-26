<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KarmaLog extends Model
{
    protected $fillable = ['user_id', 'points', 'reason'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
