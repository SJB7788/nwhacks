// app/root.jsx
import { useMemo, useState, useEffect } from "react";
import { Outlet } from "react-router";

export default function Root() {
  const [socket, setSocket] = useState(null);

  // We initialize the AudioContext once.
  // We use a state or a ref so it persists across the entire session.
  const [audio] = useState(
    () => new (window.AudioContext || window.webkitAudioContext)(),
  );

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws");

    ws.onopen = () => console.log("Connected to Sync Server");
    setSocket(ws);

    return () => ws.close();
  }, []);

  // Your summary in action:
  // This object only changes if 'socket' or 'audio' actually change.
  const contextValue = useMemo(
    () => ({
      socket,
      audio,
    }),
    [socket, audio],
  );

  return (
    <div className="layout">
      <header>Global Sync Player</header>

      {/* Passing the memoized value into the hidden Provider */}
      <Outlet context={contextValue} />

      <footer>Status: {socket ? "Online" : "Connecting..."}</footer>
    </div>
  );
}
