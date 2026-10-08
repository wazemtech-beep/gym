"use client";
import { useEffect, useRef, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";

let openCount = 0;
let previousOverflow = "";

export default function ModalOverlay({ children, className = "modal-overlay", style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    if (openCount++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    const root = overlay.current;
    if (root && !root.hasAttribute("aria-label") && !root.hasAttribute("aria-labelledby")) root.setAttribute("aria-label",root.querySelector("h1,h2,h3")?.textContent?.trim() || "Dialog");
    root?.focus({ preventScroll: true });
    const keyboard = (event: KeyboardEvent) => {
      const overlays = document.querySelectorAll("[data-gym-modal]");
      if (event.key !== "Tab" || overlays[overlays.length - 1] !== root) return;
      const items = Array.from(root?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex='0']") || []).filter(item => item.getClientRects().length && !item.closest("[hidden],[inert]"));
      const first = items[0], last = items[items.length-1];
      if (!first) { event.preventDefault(); root?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown",keyboard);
    return () => {
      document.removeEventListener("keydown",keyboard);
      if (--openCount === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  // These dialogs are mounted by client interactions; the guard keeps SSR safe.
  if (typeof document === "undefined") return null;
  return createPortal(<div {...props} ref={overlay} data-gym-modal className={className} style={{...style,zIndex:10000}} role={props.role || "dialog"} aria-modal="true" tabIndex={-1}>{children}</div>,document.body);
}
