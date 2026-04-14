import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LEE_STADIUM_URL = "https://i.ibb.co/nNmPgMws/Lee-About-Me-Image.jpg";

const SUBJECTS = [
  "Question about content",
  "Billing issue",
  "Partnership inquiry",
  "Just saying hi",
  "Other",
];

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    try {
      const trimmedData = { name: name.trim(), email: email.trim(), subject, message: message.trim() };
      const { error } = await (supabase as any)
        .from("contact_messages")
        .insert(trimmedData);
      if (error) throw error;

      // Send email notification to Lee (fire-and-forget)
      supabase.functions.invoke("send-contact-notification", { body: trimmedData }).catch(() => {});

      toast.success("Message sent! I'll get back to you soon.");
      setName("");
      setEmail("");
      setSubject(SUBJECTS[0]);
      setMessage("");
    } catch {
      toast.error("Failed to send — please try again");
    } finally {
      setSending(false);
    }
  };

  return (
    <section style={{ background: "#0F1A2E" }} className="py-12 px-4">
      <div className="mx-auto max-w-[700px]">
        <h2
          className="text-center text-[22px] sm:text-[26px] text-white mb-8"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Get in Touch with Lee
        </h2>

        <div
          className="rounded-xl p-6 sm:p-8"
          style={{ background: "#14213D", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-6 sm:gap-8">
            {/* Left: Photo + caption */}
            <div className="flex flex-col items-center text-center">
              <img
                src={LEE_STADIUM_URL}
                alt="Lee Ingram"
                className="w-[110px] h-[110px] rounded-full object-cover"
                style={{ border: "3px solid rgba(255,255,255,0.15)" }}
              />
              <p className="text-[11px] text-white/60 mt-3 leading-snug" style={{ fontFamily: "Inter, sans-serif" }}>
                Founder of<br />SurviveAccounting.com
              </p>
              <p className="text-[10px] text-white/40 mt-2 leading-snug max-w-[160px]" style={{ fontFamily: "Inter, sans-serif" }}>
                Ask a question, share feedback, or just say hello — I read every message personally.
              </p>
            </div>

            {/* Right: Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="w-full rounded-md px-3 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontFamily: "Inter, sans-serif",
                }}
              />
              <input
                type="email"
                placeholder="your@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                className="w-full rounded-md px-3 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontFamily: "Inter, sans-serif",
                }}
              />
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md px-3 py-2.5 text-[13px] text-white outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s} style={{ background: "#14213D" }}>
                    {s}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={4}
                className="w-full rounded-md px-3 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontFamily: "Inter, sans-serif",
                }}
              />
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-md py-2.5 text-[13px] font-semibold text-white transition-opacity"
                style={{
                  background: "#14213D",
                  border: "1px solid rgba(255,255,255,0.2)",
                  opacity: sending ? 0.6 : 1,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {sending ? "Sending…" : "Send to Lee →"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
