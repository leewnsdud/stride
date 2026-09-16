import React, { useEffect, useRef } from "react";
import { allowUiMotion, uiEase } from "./ui-motion.mjs";

// Keep native details/summary semantics. Only pointer toggles interpolate height.
export default function AnimatedDetails({ children, ...props }) {
  const ref = useRef(null), animation = useRef(null), target = useRef(false);
  const settle = (open) => {
    const el = ref.current;
    if (!el) return;
    el.open = open;
    el.style.height = "";
    el.style.overflow = "";
    delete el.dataset.expanded;
  };
  useEffect(() => () => { animation.current?.cancel(); }, []);
  const toggle = (event) => {
    const el = ref.current;
    if (event.target.closest("summary")?.parentElement !== el) return;
    event.preventDefault();
    const open = animation.current ? !target.current : !el.open;
    target.current = open;
    const from = el.getBoundingClientRect().height;
    animation.current?.cancel();
    animation.current = null;
    if (!allowUiMotion()) return settle(open);
    // Measure the native open and closed layouts before the next paint.
    el.style.height = "";
    el.open = open;
    const to = el.getBoundingClientRect().height;
    el.open = true;
    el.dataset.expanded = String(open);
    el.style.overflow = "hidden";
    el.style.height = `${to}px`;
    const current = el.animate([{height:`${from}px`},{height:`${to}px`}], {
      duration:200, easing:uiEase,
    });
    animation.current = current;
    current.finished.then(() => {
      if (animation.current !== current) return;
      animation.current = null;
      settle(open);
    }).catch(() => {});
  };
  return <details {...props} ref={ref} onClick={toggle}>{children}</details>;
}
