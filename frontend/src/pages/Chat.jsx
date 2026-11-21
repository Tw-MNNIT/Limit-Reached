import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Plus,
  LogOut,
  MessageCircle
} from "lucide-react";
import api from "../services/api";

export default function Chat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      const response = await api.get("/conversations");
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error("Unable to load conversations:", error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();

    const text = message.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { text, sender: "You" }]);
    setMessage("");
    setLoading(true);

    try {
      const response = await api.post("/ai/chat", {
        message: text,
        conversationId
      });

      setConversationId(response.data.conversationId);

      setMessages(prev => [
        ...prev,
        { text: response.data.reply, sender: "JOI" }
      ]);

      await loadConversations();

    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          text:
            error.response?.data?.message ||
            "Unable to connect to JOI. Please try again.",
          sender: "JOI"
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(id) {
    if (loading) return;

    try {
      const response = await api.get(`/conversations/${id}`);
      const conversation = response.data.conversation;

      setConversationId(conversation._id);

      setMessages(
        conversation.messages.map(msg => ({
          text: msg.content,
          sender: msg.role === "user" ? "You" : "JOI"
        }))
      );
    } catch (error) {
      console.error("Unable to open conversation:", error);
      alert(
        error.response?.data?.message ||
        "Unable to open this conversation."
      );
    }
  }

  function newChat() {
    if (loading) return;

    setConversationId(null);
    setMessages([]);
    setMessage("");
  }

  function logout() {
    localStorage.removeItem("joi_token");
    navigate("/");
  }

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        <h2>JOI<span>.</span></h2>

        <button onClick={newChat}>
          <Plus size={18} /> New Chat
        </button>

        <p className="history-title">YOUR SPACE</p>

        <div className="history-list">
          {historyLoading ? (
            <p>Loading chats...</p>
          ) : conversations.length === 0 ? (
            <p>No previous chats yet.</p>
          ) : (
            conversations.map(chat => (
              <div
                className="history-item"
                key={chat._id}
                onClick={() => openConversation(chat._id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    openConversation(chat._id);
                  }
                }}
              >
                <MessageCircle size={17} />
                <span>{chat.title || "New Chat"}</span>
              </div>
            ))
          )}
        </div>

        <button className="logout" onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <main className="chat-main">
        <header>
          <span>JOI Assistant</span>
          <span className="online">● Online</span>
        </header>

        <section className="messages">
          {messages.length === 0 ? (
            <div className="welcome">
              <h1>How can I help you today?</h1>
              <p>Your intelligent personal assistant is ready.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                className={`message ${
                  msg.sender === "You"
                    ? "user-message"
                    : "joi-message"
                }`}
                key={index}
              >
                <strong>{msg.sender}</strong>
                <p>{msg.text}</p>
              </div>
            ))
          )}

          {loading && (
            <div className="message joi-message">
              <strong>JOI</strong>
              <p>Thinking...</p>
            </div>
          )}
        </section>

        <form className="message-form" onSubmit={sendMessage}>
          <input
            placeholder="Ask JOI anything..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            <Send size={20} />
          </button>
        </form>

        <p className="disclaimer">
          JOI can make mistakes. Verify important information.
        </p>
      </main>
    </div>
  );
}