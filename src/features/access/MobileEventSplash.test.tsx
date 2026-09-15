import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MobileEventSplash } from "./MobileEventSplash";

describe("MobileEventSplash", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("shows a decorative mobile-only event splash once per session", () => {
    const { unmount } = render(<MobileEventSplash />);

    expect(screen.getByTestId("mobile-event-splash")).toHaveClass(
      "md:hidden",
      "motion-reduce:hidden",
    );
    expect(screen.getByText("Música · Fé · Comunhão")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("encontro-coros-mobile-splash-seen")).toBe("true");

    unmount();
    render(<MobileEventSplash />);
    expect(screen.queryByTestId("mobile-event-splash")).not.toBeInTheDocument();
  });

  it("dismisses the splash automatically without delaying login", () => {
    render(<MobileEventSplash />);

    act(() => vi.advanceTimersByTime(1_200));

    expect(screen.queryByTestId("mobile-event-splash")).not.toBeInTheDocument();
  });

  it("uses the event logo while remaining decorative to assistive technology", () => {
    render(<MobileEventSplash />);

    const splash = screen.getByTestId("mobile-event-splash");
    expect(splash).toHaveAttribute("aria-hidden", "true");
    expect(splash.querySelectorAll("img")).toHaveLength(1);
  });

  it("keeps the server render deterministic before reading session storage", () => {
    expect(renderToString(<MobileEventSplash />)).toBe("");
  });
});
