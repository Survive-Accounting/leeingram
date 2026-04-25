import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import leeHeadshot from "@/assets/lee-headshot-original.png";
import AnimatedArrow from "@/components/landing/AnimatedArrow";

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
    <section
      className="relative pt-20 sm:pt-24 pb-24 sm:pb-28 px-4 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #14213D 0%, #0B1426 100%)" }}
    >
      <style>{`
        @keyframes contactGridDrift {
          0%   { background-position: 0px 0px, 0px 0px; }
          100% { background-position: 120px 120px, 120px 120px; }
        }
        @keyframes contactDiagDrift {
          0%   { background-position: 0px 0px; }
          100% { background-position: 240px 240px; }
        }
      `}</style>

      {/* Animated grid — monochrome navy+white, low opacity, slowed ~50% */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "120px 120px, 120px 120px",
          animation: "contactGridDrift 4800s linear infinite",
          opacity: 0.28,
          filter: "blur(0.6px)",
          zIndex: 0,
        }}
      />

      {/* Diagonal sweeping lines — adds slow emotional drift */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 240px)",
          animation: "contactDiagDrift 6400s linear infinite",
          opacity: 0.22,
          filter: "blur(0.8px)",
          zIndex: 0,
        }}
      />

      {/* Dark gradient overlay — preserves text readability over the animation */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(11,15,26,0.55) 0%, rgba(11,15,26,0.78) 70%, rgba(11,15,26,0.92) 100%)",
          zIndex: 0,
        }}
      />

      <div className="relative mx-auto max-w-[640px]" style={{ zIndex: 1 }}>
        <h2
          className="text-center text-[24px] sm:text-[30px] text-white mb-3"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: "2px 2px 8px rgba(0,0,0,0.4)" }}
        >
          Stuck on something? I've got you.
        </h2>
        <div className="mb-10" />

        <div
          className="rounded-xl p-6 sm:p-8"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-5 sm:gap-7">
            {/* Left: Photo + text */}
            <div className="flex flex-col items-center text-center">
              <div
                className="w-[120px] h-[120px] rounded-full overflow-hidden"
                style={{ border: "3px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}
              >
                <img
                  src={leeHeadshot}
                  alt="Lee Ingram"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "center 15%" }}
                />
              </div>
              <p className="text-[12px] text-white/70 mt-3 leading-relaxed" style={{ fontFamily: "Inter, sans-serif" }}>
                I read and reply to every message personally.
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
                className="group w-full rounded-lg py-2.5 text-[13px] font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] inline-flex items-center justify-center"
                style={{
                  background: "#CE1126",
                  boxShadow: "0 2px 12px rgba(206,17,38,0.25)",
                  opacity: sending ? 0.6 : 1,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {sending ? "Sending…" : <>Send to Lee <AnimatedArrow /></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
