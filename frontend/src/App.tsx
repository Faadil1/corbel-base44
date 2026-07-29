import React from "react";
import CorbelLive from "./components/CorbelLive";
import CorbelPreview from "./pages/CorbelPreview";

export default function App() {
  if (window.location.pathname === "/corbel-preview") {
    return <CorbelPreview />;
  }

  return <CorbelLive />;
}
