export default function manifest() {
  return {
    name: "The OpenOrgan Project",
    short_name: "OpenOrgan",
    description: "Find organs and events, offer practice access, and publish events.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f5f0",
    theme_color: "#5f1730",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }]
  };
}
