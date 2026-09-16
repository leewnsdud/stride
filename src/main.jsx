import React from "react";
import { createRoot } from "react-dom/client";
import { IconContext } from "./icons.jsx";
import App from "./App.jsx";
import { registerPwa } from "./pwa.mjs";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: "regular" }}>
      <App />
    </IconContext.Provider>
  </React.StrictMode>,
);

registerPwa();
