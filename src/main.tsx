import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { SessionProvider } from "./state/session";
import { ToastProvider } from "./ui/kit";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/app.css";
import "./styles/landing.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <SessionProvider>
        <App />
      </SessionProvider>
    </ToastProvider>
  </StrictMode>,
);
