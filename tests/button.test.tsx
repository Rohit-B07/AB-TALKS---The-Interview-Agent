// @vitest-environment jsdom
//
// Regression test for the Base UI `nativeButton` console error.
//
// Base UI's <Button> logs "Base UI: A component that acts as a button expected
// a native <button>..." in a post-mount effect whenever `nativeButton` (default
// `true`) is true but the rendered element is not a native <button>. This file
// mounts real components in a DOM so that effect actually runs, and asserts the
// shared Button always renders with native button semantics (no warning) while
// link-styled navigation renders as real anchors.

import type * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) => (
    <a href={typeof href === "string" ? href : "/"} {...rest}>
      {children}
    </a>
  ),
}));

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SessionExpired } from "@/components/interview/session-expired";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function mount(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("shared Button native button semantics", () => {
  let errors: string[];

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a native <button type=\"button\"> with no Base UI warnings", () => {
    const { container, cleanup } = mount(<Button size="lg">Begin Interview</Button>);

    const el = container.querySelector("button");
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("BUTTON");
    expect(el!.getAttribute("type")).toBe("button");
    expect(el!.textContent).toBe("Begin Interview");

    cleanup();
    expect(errors.filter((message) => message.includes("Base UI"))).toEqual([]);
  });

  it("keeps the disabled state on the native button", () => {
    const { container, cleanup } = mount(<Button disabled>Submit answer</Button>);

    const el = container.querySelector("button");
    expect(el).not.toBeNull();
    expect(el!.hasAttribute("disabled")).toBe(true);

    cleanup();
    expect(errors.filter((message) => message.includes("Base UI"))).toEqual([]);
  });

  it("keeps type=\"submit\" for form submit buttons", () => {
    const { container, cleanup } = mount(<Button type="submit">Submit answer</Button>);

    const el = container.querySelector("button");
    expect(el).not.toBeNull();
    expect(el!.getAttribute("type")).toBe("submit");

    cleanup();
    expect(errors.filter((message) => message.includes("Base UI"))).toEqual([]);
  });

  it("renders the home CTA link as a native anchor", () => {
    const { container, cleanup } = mount(
      <a href="#candidates" className={cn(buttonVariants({ size: "lg" }), "mt-2 gap-2")}>
        Choose Your Candidate
      </a>
    );

    const el = container.querySelector("a");
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("A");
    expect(el!.getAttribute("href")).toBe("#candidates");

    cleanup();
    expect(errors.filter((message) => message.includes("Base UI"))).toEqual([]);
  });

  it("renders the session-expired navigation as a native anchor", () => {
    const { container, cleanup } = mount(<SessionExpired />);

    const el = container.querySelector("a");
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("A");
    expect(el!.getAttribute("href")).toBe("/");

    cleanup();
    expect(errors.filter((message) => message.includes("Base UI"))).toEqual([]);
  });

  it("guards against Button misuse with a non-button render (documents the warning)", () => {
    const { cleanup } = mount(<Button render={<a href="#x" />}>Begin</Button>);
    cleanup();

    expect(
      errors.some(
        (message) => message.includes("Base UI") && message.includes("nativeButton")
      )
    ).toBe(true);
  });
});
