import { useMemo, useState, useEffect } from "react";
import {
  isRouteErrorResponse, // checks if caught error is a specific response error thrown by loader or action
  Links, // injects all <link> tags into HTML <head>
  // - looks at the links function export in this file and all active router files
  // - gathers all stylesheet, favicon and preconnect tags and renders them
  Meta, // renders all <meta> tags
  Outlet,
  Scripts, // Hydration trigger
  // loads react framework and application code
  // wakes up react app in the browser, attaching event listeners and starting useEffect hooks
  ScrollRestoration, // an emulated browser behavior manager
  // since react changes page content without full refresh, browser native scroll memory often fails
  // this component manually fixes the issue
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [audio, setAudio] = useState<AudioContext | null>(null);

  useEffect(() => {
    const audioCtx = new window.AudioContext();
    setAudio(audioCtx);

    const ws = new WebSocket("ws://localhost:8080/ws");
    ws.onopen = () => console.log("Connected to Sync Server");

    setSocket(ws);

    // clean up function
    return () => {
      // clean up functions run two ways:
      // 1. right before components unmounts
      ws.close();
      audioCtx.close();
    };
  }, []); // 2. if dependency array changes, cleans up right before useEffect reruns

  const contextValue = useMemo(
    () => ({
      socket,
      audio,
      isReady: !!(socket && audio), // !!null == false
    }),
    [socket, audio],
  );

  return (
    <div className="">
      <Outlet context={contextValue} />
      <div className="status-indicator">
        {socket ? "🟢 Connected" : "🔴 Disconnected"}
      </div>{" "}
    </div>
  );

  // Outlet: placeholder for child routes
  // outlet does not re-render when URL changes
  // - any variables, websocket connections etc, are preserved in memory
  //
  // Outlet can also provide context to child components using useOutletContext
  // - Context: dependencies or packages that the parent want to pass to children
  //
  // useOutletContext provides a hidden Provider for the child component which removes the work to create a context obj,
  // setup a provider and import context into every child file
  //
  // Parent re-render and chlid render interationcs:
  // <Outlet context={{ socket, audio }} />  <- creates new obj everytime parent is re-rendered which makes child components to re-render
  // even if the values inside did not change
  //
  // To avoid this issue, useMemo is used:
  // const contextValue = useMemo(() => ({ socket, audio }), [socket, audio]);
  //
  // useMemo: a React Hook that lets you cache the result of a calculation between re-renders
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
