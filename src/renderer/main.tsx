// Mounts the desktop renderer.
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Tooltip } from "./Tooltip";
import "./styles.css";
import "./theme.css";
const root = document.getElementById("root");
if (!root) throw Error("Missing root element");
createRoot(root).render(
  new URLSearchParams(location.search).get("view") === "tooltip" ? (
    <Tooltip />
  ) : (
    <App />
  ),
);
