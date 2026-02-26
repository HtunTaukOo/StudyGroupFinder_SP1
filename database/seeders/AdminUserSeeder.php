<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $adminData = [
            'name' => 'StudyHub Admin',
            'email' => 'studyhub.studygroupfinder@gmail.com',
            'password' => Hash::make('studygroupfinder123'),
            'role' => 'admin',
            'major' => 'Administration',
            'bio' => 'StudyHub System Administrator',
            'location' => 'AU Campus',
        ];

        $existingAdmin = User::where('email', $adminData['email'])->first();

        if (!$existingAdmin) {
            User::create($adminData);
            $this->command->info('Admin user created: ' . $adminData['email']);
        } else {
            $existingAdmin->update(['role' => 'admin']);
            $this->command->info('Admin user already exists (role updated): ' . $adminData['email']);
        }

        // Demote any other user with admin role (there can only be one admin)
        User::where('role', 'admin')
            ->where('email', '!=', 'studyhub.studygroupfinder@gmail.com')
            ->update(['role' => 'member']);
    }
}
