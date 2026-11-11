import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
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
