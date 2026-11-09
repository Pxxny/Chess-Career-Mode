import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
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
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);
