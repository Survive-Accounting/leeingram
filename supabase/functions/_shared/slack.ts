export async function postToSlack(
  message: string,
  thread_ts?: string
): Promise<string | null> {
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!webhookUrl) return null;

  const payload: Record<string, unknown> = { text: message };
  if (thread_ts) payload.thread_ts = thread_ts;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // Slack incoming webhooks return "ok" as text, not JSON with ts
    // Thread tracking requires the Slack API (chat.postMessage), not webhooks
    // For now we just confirm delivery
    if (res.ok) return "sent";
    return null;
  } catch {
    return null;
  }
}
