<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation Accepted</title>
</head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:Arial, sans-serif; color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc; padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                    <tr>
                        <td style="background:#16a34a; color:#ffffff; padding:20px 24px;">
                            <h1 style="margin:0; font-size:20px; line-height:1.4;">Invitation accepted</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px;">
                            <p style="margin:0 0 12px 0;">Hi {{ $leaderName }},</p>
                            <p style="margin:0 0 12px 0;">
                                <strong>{{ $userName }}</strong> accepted your invitation to join
                                <strong>{{ $groupName }}</strong>.
                            </p>
                            <p style="margin:0 0 20px 0;">
                                You can now see them in your group members list.
                            </p>
                            <p style="margin:0; font-size:12px; color:#64748b;">
                                This is an automated message from StudyHub.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
