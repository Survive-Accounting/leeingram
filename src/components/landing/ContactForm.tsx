import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LEE_STADIUM_URL = "https://i.ibb.co/nNmPgMws/Lee-About-Me-Image.jpg";

const SUBJECTS = [
  "I'm stuck on something",
  "Not sure where to start",
  "Question about the course",
  "Just saying hi",
];

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("I'm stuck on something");
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

      supabase.functions.invoke("send-contact-notification", { body: trimmedData }).catch(() => {});

      toast.success("Message sent! I'll get back to you soon.");
      setName("");
      setEmail("");
      setSubject("I'm stuck on something");
      setMessage("");
    } catch {
      toast.error("Failed to send — please try again");
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <section style={{ background: "#0F1A2E" }} className="py-12 px-4">
      <div className="mx-auto max-w-[640px]">
        <h2
          className="text-center text-[20px] sm:text-[24px] text-white mb-8"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Have a question? I've got you.
        </h2>

        <div
          className="rounded-xl p-5 sm:p-7"
          style={{ background: "rgba(20,33,61,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-5 sm:gap-7">
            {/* Left: Photo + text */}
            <div className="flex flex-col items-center text-center">
              <div
                className="w-[120px] h-[120px] rounded-full overflow-hidden"
                style={{ border: "3px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}
              >
                <img
                  src={LEE_STADIUM_URL}
                  alt="Lee Ingram"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "center 20%", transform: "scale(1.3)" }}
                />
              </div>
              <p className="text-[12px] text-white/70 mt-3 leading-relaxed" style={{ fontFamily: "Inter, sans-serif" }}>
                I read and reply to every message personally.
              </p>
              <p className="text-[12px] text-white/50 mt-2 leading-relaxed max-w-[170px]" style={{ fontFamily: "Inter, sans-serif" }}>
                Whether you're stuck on something or just not sure where to start — feel free to reach out.
              </p>
              <p className="text-[11px] text-white/35 mt-3 italic" style={{ fontFamily: "Inter, sans-serif" }}>
                No pressure. Just real help.
              </p>
            </div>

            {/* Right: Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/30 outline-none"
                style={inputStyle}
              />
              <input
                type="email"
                placeholder="your@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                className="w-full rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/30 outline-none"
                style={inputStyle}
              />
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-[13px] text-white outline-none"
                style={inputStyle}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s} style={{ background: "#14213D" }}>
                    {s}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="What are you stuck on?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/30 outline-none resize-none"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-lg py-2.5 text-[13px] font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: "#CE1126",
                  boxShadow: "0 2px 12px rgba(206,17,38,0.25)",
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
