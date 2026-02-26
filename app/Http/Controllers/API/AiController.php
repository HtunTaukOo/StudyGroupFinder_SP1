<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiController extends Controller
{
    private function generateFromGemini(string $prompt): string
    {
        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey) {
            return 'AI service is not configured.';
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
        $response = Http::timeout(30)->post($url . '?key=' . $apiKey, [
            'contents' => [[
                'parts' => [[
                    'text' => $prompt,
                ]],
            ]],
        ]);

        if (!$response->ok()) {
            return 'AI service is currently unavailable.';
        }

        $text = data_get($response->json(), 'candidates.0.content.parts.0.text');
        return is_string($text) && $text !== '' ? $text : 'No response generated.';
    }

    public function generateGroupDescription(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'goal' => 'required|string|max:1000',
        ]);

        $prompt = "Create a single, concise study group description (2-3 sentences max) for a group focused on \"{$validated['subject']}\".
Primary goal: \"{$validated['goal']}\".

Requirements:
- Write in plain text without special formatting, markdown, or asterisks
- Keep it welcoming and professional for university students
- Focus on what members will do and achieve together
- Do NOT include multiple options or variations
- Maximum 150 words";

        return response()->json([
            'text' => $this->generateFromGemini($prompt),
        ]);
    }

    public function summarizeChat(Request $request)
    {
        $validated = $request->validate([
            'messages' => 'required|array|min:1',
            'messages.*' => 'required|string',
        ]);

        $messages = implode("\n", $validated['messages']);
        $prompt = "Analyze these study group chat messages and create a brief summary.

Messages:
{$messages}

Format your response EXACTLY as follows (use plain text, no markdown, no asterisks):

Key Takeaways:
- [Point 1]
- [Point 2]
- [Point 3]

Action Items:
- [Action 1 with any relevant details like date/time/location]
- [Action 2 with any relevant details like date/time/location]

Keep it concise and clear. Maximum 5 bullet points total.";

        return response()->json([
            'text' => $this->generateFromGemini($prompt),
        ]);
    }

    public function suggestStudyPlan(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
        ]);

        $prompt = "Create a clear, organized 4-week study plan for \"{$validated['subject']}\".

Format requirements:
- Use plain text with simple headings (Week 1:, Week 2:, etc.)
- Use bullet points (-) for topics and tasks
- No markdown formatting, bold, italics, or asterisks
- Keep each week's plan to 4-5 bullet points maximum
- Be specific about topics to cover and activities to complete
- Total length: maximum 300 words

Example format:
Week 1: [Theme]
- Topic or activity
- Topic or activity

Week 2: [Theme]
- Topic or activity
- Topic or activity";

        return response()->json([
            'text' => $this->generateFromGemini($prompt),
        ]);
    }
}
