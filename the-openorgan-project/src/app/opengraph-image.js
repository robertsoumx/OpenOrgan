import { ImageResponse } from "next/og";

export const alt = "The OpenOrgan Project";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#f7f2ee",
          color: "#2b1720",
          fontFamily: "Arial, sans-serif",
          overflow: "hidden"
        }}
      >
        <div style={{ position: "absolute", inset: "0 0 auto 0", height: 18, background: "#8f1838" }} />
        <div style={{ position: "absolute", left: 64, top: 92, width: 160, height: 360, display: "flex", gap: 13, alignItems: "flex-end" }}>
          {[210, 320, 260, 360].map((height, index) => (
            <div key={index} style={{ width: 28, height, background: index === 1 ? "#a3444a" : "#6f1730" }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 290, paddingRight: 90 }}>
          <div style={{ fontSize: 28, textTransform: "uppercase", letterSpacing: 7, color: "#a3444a", marginBottom: 24 }}>
            The OpenOrgan Project
          </div>
          <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.02, maxWidth: 820 }}>
            Pipe organs. Practice access. Local events.
          </div>
          <div style={{ fontSize: 28, marginTop: 30, color: "#684b56" }}>
            Beginning in Greater Boston · openorgan.org
          </div>
        </div>
        <div style={{ position: "absolute", right: 0, bottom: 0, width: 340, height: 24, background: "#c96579" }} />
      </div>
    ),
    size
  );
}
