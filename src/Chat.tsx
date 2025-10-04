import { useEffect, useRef, useState } from "react";

interface Message {
  user: "me" | "agent";
  text: string;
  timestamp: string;
}

interface ChatProps {
  token: string;
  userId: number;
  handleLogout: () => void;
}

export default function Chat({ token, userId, handleLogout }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false); // Added connection state
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectInterval = useRef(1000);

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const connectWebSocket = () => {
    ws.current = new WebSocket("ws://localhost:8000/agents/ws");

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true); // Update connection status
      reconnectAttempts.current = 0;
      reconnectInterval.current = 1000;

      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            token,
            agent_name: "default",
            query: "init",
            session_id: "",
            user_id: userId,
          })
        );
      } else {
        console.error("WebSocket not in OPEN state");
      }
    };

    ws.current.onmessage = (event) => {
      try {
        console.log("message incoming ", event.data);
        const msg = JSON.parse(event.data);
        const newMessage: Message = {
          user: "agent",
          text: msg.error ? `Error: ${msg.error}` : msg.text || JSON.stringify(msg),
          timestamp: getCurrentTime(),
        };
        setMessages((prev) => [...prev, newMessage]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { user: "agent", text: event.data, timestamp: getCurrentTime() },
        ]);
      }
    };

    ws.current.onclose = (event) => {
      console.log("WebSocket closed", event);
      setIsConnected(false); // Update connection status
      // if (reconnectAttempts.current < maxReconnectAttempts) {
      //   setTimeout(() => {
      //     console.log(`Reconnecting... Attempt ${reconnectAttempts.current + 1}`);
      //     reconnectAttempts.current += 1;
      //     reconnectInterval.current = Math.min(reconnectInterval.current * 2, 30000);
      //     connectWebSocket();
      //   }, reconnectInterval.current);
      // } else {
      //   console.log("Max reconnection attempts reached");
      //   setMessages((prev) => [
      //     ...prev,
      //     { user: "agent", text: "Error: Unable to reconnect to server", timestamp: getCurrentTime() },
      //   ]);
      // }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error", error);
      setIsConnected(false); // Update connection status
      ws.current?.close();
    };
  };

  useEffect(() => {
    // connectWebSocket();
    return () => {
      ws.current?.close();
      setIsConnected(false);
    };
  }, [token, userId]);

  const sendMessage = () => {
    if (!input.trim()) return;
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setMessages((prev) => [
        ...prev,
        { user: "agent", text: "Error: Not connected to server", timestamp: getCurrentTime() },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { user: "me", text: input, timestamp: getCurrentTime() }]);
    ws.current.send(
      JSON.stringify({
        agent_name: "default",
        query: input,
        session_id: "",
        user_id: userId,
      })
    );
    setInput("");
  };

  const handleConnect = () => {
    if (!isConnected ) {
      connectWebSocket();
    }
    
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="chat-header-title">
          <i className="fas fa-comment-alt"></i> SimpleChat
        </div>
        <div className="chat-header-options">
          <span className="signal-light" style={{ backgroundColor: isConnected ? "green" : "red" }}></span>
          <button className="connect-btn" onClick={handleConnect} disabled={isConnected}>
            {isConnected ? "Connected" : "Connect"}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
          <span><i className="fas fa-cog"></i></span>
        </div>
      </header>
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.user === "me" ? "me" : "agent"}`}>
            <div
              className="msg-img"
            ></div>
            <div className="msg-bubble">
              <div className="msg-info">
                <div className="msg-info-name">{m.user === "me" ? "You" : "Bot"}</div>
                <div className="msg-info-time">{m.timestamp}</div>
              </div>
              <div className="msg-text">{m.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Enter your message..."
          disabled={!isConnected} // Disable input when not connected
        />
        <button onClick={sendMessage} disabled={!isConnected}>
          Send
        </button>
      </div>
    </div>
  );
}