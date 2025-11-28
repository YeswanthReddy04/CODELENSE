import React from "react";
import { createRoot } from "react-dom/client";
import CSVVisualizer from "./App";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<CSVVisualizer />);
