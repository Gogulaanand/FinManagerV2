export interface EmailMessage {
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !from) throw new Error('Email delivery is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!response.ok)
    throw new Error(`Resend returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
}
