import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/app/styles/index.css";

// eslint-disable-next-line react-refresh/only-export-components
function App() {
  return <h1>Home Inventory</h1>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
