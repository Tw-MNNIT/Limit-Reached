
import { useState, useEffect, useRef } from "react";
import {
  Send,
  Plus,
  MessageCircle,
  Sparkles,
  PanelLeft,
} from "lucide-react";
import api from "../services/api";

export default function Chat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const maxHeight = 220;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [message]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

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

    setMessages((prev) => [...prev, { text, sender: "You" }]);
    setMessage("");
    setLoading(true);

    try {
      const response = await api.post("/ai/chat", {
        message: text,
        conversationId,
      });

      setConversationId(response.data.conversationId);

      setMessages((prev) => [
        ...prev,
        { text: response.data.reply, sender: "JOI" },
      ]);

      await loadConversations();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          text:
            error.response?.data?.message ||
            "Unable to connect to JOI. Please try again.",
          sender: "JOI",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function openConversation(id) {
    if (loading || id === conversationId) return;

    try {
      const response = await api.get(`/conversations/${id}`);
      const conversation = response.data.conversation;

      setConversationId(conversation._id);

      setMessages(
        conversation.messages.map((msg) => ({
          text: msg.content,
          sender: msg.role === "user" ? "You" : "JOI",
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
    textareaRef.current?.focus();
  }

  function handleComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="chat-workspace">
      {historyOpen && (
        <aside className="sidebar chat-history-sidebar">
          <div className="chat-history-top">
            <p className="history-title">YOUR CHATS</p>

            <button
              className="history-collapse"
              type="button"
              onClick={() => setHistoryOpen(false)}
              aria-label="Hide chat history"
              title="Hide chat history"
            >
              <PanelLeft size={17} />
            </button>
          </div>

          <button
            className="new-chat-button"
            type="button"
            onClick={newChat}
            disabled={loading}
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>

          <div className="history-list">
            {historyLoading ? (
              <p className="history-empty">Loading chats...</p>
            ) : conversations.length === 0 ? (
              <p className="history-empty">
                Your conversations will appear here.
              </p>
            ) : (
              conversations.map((chat) => (
                <button
                  className={`history-item ${
                    conversationId === chat._id ? "active" : ""
                  }`}
                  key={chat._id}
                  type="button"
                  onClick={() => openConversation(chat._id)}
                  disabled={loading}
                  title={chat.title || "New Chat"}
                >
                  <MessageCircle size={16} />
                  <span>{chat.title || "New Chat"}</span>
                </button>
              ))
            )}
          </div>
        </aside>
      )}

      <main className="chat-main">
        <header className="chat-topbar">
          <div className="chat-topbar-title">
            {!historyOpen && (
              <button
                className="history-collapse"
                type="button"
                onClick={() => setHistoryOpen(true)}
                aria-label="Show chat history"
                title="Show chat history"
              >
                <PanelLeft size={18} />
              </button>
            )}

            <div className="chat-topbar-avatar">
              <Sparkles size={17} />
            </div>

            <div>
              <span className="chat-assistant-name">JOI Assistant</span>
              <span className="chat-assistant-status">
                <span className="online-dot" />
                Ready to help
              </span>
            </div>
          </div>
        </header>

        <section className="messages" aria-live="polite">
          <div className="chat-conversation">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-icon">
                  <Sparkles size={25} />
                </div>

                <p className="welcome-eyebrow">YOUR AI COMPANION</p>

                <h1>
                  How can I help
                  <br />
                  <span>you today?</span>
                </h1>

                <p className="welcome-description">
                  Ask a question, explore an idea, or simply start a
                  conversation. I'm here whenever you need me.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.sender === "You";

                return (
                  <div
                    className={`message-row ${
                      isUser ? "message-row-user" : "message-row-joi"
                    }`}
                    key={`${index}-${msg.sender}`}
                  >
                    {!isUser && (
                      <div className="message-avatar">
                        <Sparkles size={15} />
                      </div>
                    )}

                    <div
                      className={`message ${
                        isUser ? "user-message" : "joi-message"
                      } ${msg.isError ? "message-error" : ""}`}
                    >
                      <span className="message-sender">
                        {isUser ? "You" : "JOI"}
                      </span>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                );
              })
            )}

            {loading && (
              <div className="message-row message-row-joi">
                <div className="message-avatar">
                  <Sparkles size={15} />
                </div>

                <div className="message joi-message typing-message">
                  <span className="message-sender">JOI</span>
                  <div className="typing-indicator" aria-label="JOI is thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </section>

        <div className="chat-composer-area">
          <form className="message-form" onSubmit={sendMessage}>
            <textarea
              ref={textareaRef}
              className="message-textarea"
              placeholder="Message JOI..."
              aria-label="Write a message to JOI"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={loading}
              rows={1}
            />

            <button
              className="send-message-button"
              type="submit"
              disabled={loading || !message.trim()}
              aria-label="Send message"
              title="Send message"
            >
              <Send size={18} />
            </button>
          </form>

          <p className="disclaimer">
            JOI can make mistakes. Verify important information.
          </p>
        </div>
      </main>
    </div>
  );
}
