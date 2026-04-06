"use client";

import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are the AI parser for a Career Engine app. The user will give natural language commands to update their resume/portfolio data.

Your job is to:
1. Parse the intent
2. Return ONLY a JSON object — no explanation, no markdown, no extra text

JSON schema:
{
  "action": "add" | "update" | "remove" | "improve" | "generate",
  "field": "skills" | "experience" | "projects" | "summary" | "education" | "resume",
  "value": <string or object>,
  "confirmation": <short human-friendly sentence describing what you did>
}

Examples:
User: "Add React Native to my skills"
{"action":"add","field":"skills","value":"React Native","confirmation":"Added React Native to your skills."}

User: "Remove MongoDB from skills"
{"action":"remove","field":"skills","value":"MongoDB","confirmation":"Removed MongoDB from your skills."}

User: "Update my summary to focus on full stack development"
{"action":"update","field":"summary","value":"Focus on full stack development","confirmation":"Updated your summary to highlight full stack development."}

User: "Improve my internship description"
{"action":"improve","field":"experience","value":"internship","confirmation":"I'll enhance your internship bullet points for ATS."}

User: "Generate a resume for a frontend role"
{"action":"generate","field":"resume","value":"frontend","confirmation":"Generating a tailored resume for frontend roles."}

ONLY return the JSON. Nothing else.`;

const ACTION_COLORS = {
  add:      { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7", label: "ADD" },
  update:   { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd", label: "UPDATE" },
  remove:   { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5", label: "REMOVE" },
  improve:  { bg: "#fef3c7", text: "#92400e", border: "#fcd34d", label: "IMPROVE" },
  generate: { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd", label: "GENERATE" },
};

const SUGGESTIONS = [
  "Add Next.js to my skills",
  "Remove MongoDB from skills",
  "Improve my project description",
  "Generate resume for a frontend role",
  "Update my summary to focus on AI",
];

function ParsedResult({ parsed }) {
  const colors = ACTION_COLORS[parsed.action] || ACTION_COLORS.update;
  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      padding: "10px 14px",
      marginTop: 8,
      fontFamily: "'DM Mono', monospace",
      fontSize: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{
          background: colors.border,
          color: colors.text,
          fontWeight: 700,
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 4,
          letterSpacing: 1,
        }}>{colors.label}</span>
        <span style={{ color: colors.text, fontWeight: 600 }}>{parsed.field}</span>
      </div>
      {parsed.value && (
        <div style={{ color: colors.text, opacity: 0.85, marginBottom: 4 }}>
          <span style={{ opacity: 0.6 }}>value → </span>
          {typeof parsed.value === "object" ? JSON.stringify(parsed.value) : parsed.value}
        </div>
      )}
      <div style={{ color: colors.text, fontWeight: 500, fontSize: 12.5, fontFamily: "'DM Sans', sans-serif" }}>
        ✓ {parsed.confirmation}
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16,
      animation: "fadeUp 0.25s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, marginRight: 8, flexShrink: 0, marginTop: 2,
          boxShadow: "0 2px 8px #6366f140",
        }}>⚡</div>
      )}
      <div style={{ maxWidth: "78%" }}>
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
          background: isUser ? "#6366f1" : "#f8f8fb",
          color: isUser ? "#fff" : "#1a1a2e",
          fontSize: 14,
          lineHeight: 1.55,
          border: isUser ? "none" : "1px solid #e8e8f0",
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: isUser ? 500 : 400,
        }}>
          {msg.content}
        </div>
        {msg.parsed && <ParsedResult parsed={msg.parsed} />}
        {msg.error && (
          <div style={{
            marginTop: 6, fontSize: 12, color: "#ef4444",
            fontFamily: "'DM Mono', monospace",
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 6, padding: "6px 10px",
          }}>⚠ {msg.error}</div>
        )}
      </div>
    </div>
  );
}

export default function CareerEngineChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hey! I'm your Career Engine AI. Tell me what to update — skills, experience, projects, or just ask me to generate a tailored resume.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    try {
      // Hits your Next.js API route — API key stays server-side
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userText }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content?.trim();

      let parsed = null;
      let errorMsg = null;

      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        errorMsg = "Couldn't parse AI response. Raw: " + raw;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: parsed
            ? parsed.confirmation
            : "I received your request but couldn't structure it properly.",
          parsed,
          error: errorMsg,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Check your API setup.",
          error: err.message,
        },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        .send-btn:hover { background: #4f46e5 !important; }
        .send-btn:active { transform: scale(0.96); }
        .chip:hover { background: #ede9fe !important; border-color: #a78bfa !important; cursor: pointer; }
        .msg-input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px #6366f120; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#f0f0f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 640,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 8px 40px #6366f118, 0 2px 8px #0001",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e8e8f0",
        }}>

          {/* Header */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f0f0f7",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#fafafd",
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, boxShadow: "0 4px 12px #6366f130",
            }}>⚡</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#1a1a2e" }}>Career Engine</div>
              <div style={{ fontSize: 12, color: "#8b8ba7" }}>AI Resume Parser</div>
            </div>
            <div style={{
              marginLeft: "auto", fontSize: 11, color: "#22c55e",
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              padding: "3px 9px", borderRadius: 20, fontWeight: 500,
            }}>● Live</div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 20px 8px",
            minHeight: 340,
            maxHeight: 440,
          }}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                }}>⚡</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "#6366f1",
                      animation: `pulse 1.2s ease ${d}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          <div style={{
            padding: "8px 20px 0",
            display: "flex", gap: 7, flexWrap: "wrap",
          }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="chip"
                onClick={() => sendMessage(s)}
                style={{
                  fontSize: 11.5, padding: "4px 10px",
                  border: "1px solid #e0e0ee",
                  borderRadius: 20, background: "#f8f8fd",
                  color: "#6366f1", fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500, transition: "all 0.15s",
                }}
              >{s}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{
            padding: "12px 16px 16px",
            display: "flex", gap: 10, alignItems: "flex-end",
          }}>
            <textarea
              ref={inputRef}
              className="msg-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder='Try "Add TypeScript to my skills"...'
              rows={1}
              style={{
                flex: 1, resize: "none", border: "1.5px solid #e0e0ee",
                borderRadius: 12, padding: "10px 14px",
                fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                color: "#1a1a2e", background: "#fafafd",
                transition: "border-color 0.2s, box-shadow 0.2s",
                lineHeight: 1.5,
              }}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 42, height: 42, borderRadius: 12,
                background: loading || !input.trim() ? "#e0e0ee" : "#6366f1",
                border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, transition: "all 0.15s", flexShrink: 0,
                color: loading || !input.trim() ? "#aaa" : "#fff",
              }}
            >→</button>
          </div>
        </div>
      </div>
    </>
  );
}