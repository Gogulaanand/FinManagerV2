export interface EmailMessage {
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export async function sendEmail(message: EmailMessage, idempotencyKey?: string): Promise<string> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !from) throw new Error('Email delivery is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    signal: AbortSignal.timeout(15000),
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
  const result = await response.json();
  if (typeof result.id !== 'string') throw new Error('Email provider returned no message ID.');
  return result.id;
}

/** Read-only delivery evidence; never interpret API acceptance as recipient-server delivery. */
export async function emailDeliveryStatus(providerId: string): Promise<string> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('Email delivery is not configured.');
  const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(providerId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Email delivery verification returned ${response.status}.`);
  const result = await response.json();
  if (result.id !== providerId || typeof result.last_event !== 'string')
    throw new Error('Email provider returned invalid delivery evidence.');
  return result.last_event;
}
