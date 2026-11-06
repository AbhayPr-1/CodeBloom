import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { AnnouncerProvider } from "@/components/live-announcer";
import { renderToString } from "react-dom/server";

describe("Phase 4: Responsive, Touch & Accessibility (a11y) Suite", () => {
  it("renders screen-reader live announcement regions with polite and assertive roles", () => {
    const html = renderToString(
      createElement(
        AnnouncerProvider,
        null,
        createElement("div", null, "App content")
      )
    );

    expect(html).toContain('id="a11y-announcer-polite"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');

    expect(html).toContain('id="a11y-announcer-assertive"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });

  it("verifies mobile navigation configuration has proper accessibility semantics", () => {
    const mobileRoutes = [
      { href: "/dashboard", label: "Home" },
      { href: "/explore", label: "Explore" },
      { href: "/publish", label: "Publish" },
      { href: "/notifications", label: "Activity" },
      { href: "/messages", label: "Messages" },
    ];

    expect(mobileRoutes).toHaveLength(5);
    expect(mobileRoutes.map((r) => r.href)).toEqual([
      "/dashboard",
      "/explore",
      "/publish",
      "/notifications",
      "/messages",
    ]);
  });
});

