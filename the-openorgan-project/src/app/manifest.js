export default function manifest() {
  return {
    name: "The OpenOrgan Project",
    short_name: "OpenOrgan",
    description: "Pipe organ access and events, beginning in Greater Boston.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f5f0",
    theme_color: "#5f1730",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }]
  };
}
