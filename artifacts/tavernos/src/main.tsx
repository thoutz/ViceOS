import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

/** When the UI is hosted separately from the API, set `VITE_API_BASE_URL` (e.g. `https://your-api-host`) */
const apiBase = import.meta.env.VITE_API_BASE_URL;
if (typeof apiBase === "string" && apiBase.trim().length > 0) {
  setBaseUrl(apiBase.trim());
}

createRoot(document.getElementById("root")!).render(<App />);
