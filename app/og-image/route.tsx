import { ImageResponse } from "next/og";

export const revalidate = 86_400;

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "66px 76px",
        color: "#f7f6f2",
        background: "linear-gradient(135deg, #051727 0%, #0b0c18 58%, #101a2e 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", width: 40, height: 40, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 16, height: 16, borderRadius: 5, background: "#0a8cff" }} />
          <div style={{ position: "absolute", right: 0, top: 0, width: 16, height: 16, borderRadius: 5, background: "#1f52f6" }} />
          <div style={{ position: "absolute", left: 0, bottom: 0, width: 16, height: 16, borderRadius: 5, background: "#3b0de7" }} />
          <div style={{ position: "absolute", right: 0, bottom: 0, width: 16, height: 16, borderRadius: 5, background: "#5ab7ff" }} />
        </div>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1 }}>codebloom</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
        <span style={{ color: "#38bdf8", fontSize: 18, fontWeight: 700, letterSpacing: 4 }}>DISCOVER · DISCUSS · BUILD UPON</span>
        <h1 style={{ margin: "20px 0 14px", fontSize: 70, lineHeight: 1.05, letterSpacing: -3, fontWeight: 700 }}>
          Good ideas grow together.
        </h1>
        <p style={{ margin: 0, maxWidth: 860, color: "#c4c2bb", fontSize: 27, lineHeight: 1.35 }}>
          Explore open-source projects, developer tools, and the stories behind what people build.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #53534c", paddingTop: 20, color: "#c4c2bb", fontSize: 17 }}>
        <span>A project-centered developer community</span>
        <span style={{ color: "#38bdf8", fontWeight: 700 }}>CODEBLOOM</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
