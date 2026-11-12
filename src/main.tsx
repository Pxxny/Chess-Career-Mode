import { Toaster } from "sonner";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { PerformanceMenu } from "./features/diagnostics/PerformanceMenu";
import { InstallProvider } from "./features/install/InstallProvider";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-thai";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <ErrorBoundary scope="app">
          <InstallProvider>
            <App />
            <Toaster theme="dark" position="bottom-right" offset={96} closeButton toastOptions={{ style: { background: "#222d26", color: "#eeeae1", borderColor: "#3b4b3e" } }} />
            <PerformanceMenu />
          </InstallProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is optional */
    });
  });
