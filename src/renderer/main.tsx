// Mounts the desktop renderer.
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
const root = document.getElementById("root");
if (!root) throw Error("Missing root element");
createRoot(root).render(<App />);
