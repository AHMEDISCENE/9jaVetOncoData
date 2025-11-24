import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string, resetLink: string) {
  try {
    const gmail = await getGmailClient();
    
    const emailContent = `
Hello,

You requested a password reset for your 9ja VetOncoData account. 

Your password reset token is: ${resetToken}

Alternatively, you can use this link to reset your password:
${resetLink}

This token will expire in 24 hours.

If you did not request this password reset, please ignore this email.

Best regards,
9ja VetOncoData Team
    `.trim();

    const message = [
      `From: noreply@9javetoncdata.com`,
      `To: ${toEmail}`,
      `Subject: Password Reset Request - 9ja VetOncoData`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      emailContent
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`[EMAIL] Password reset email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}
