import React, { useEffect, useId, useRef, useState } from "react";
import { allowUiMotion, uiEase } from "./ui-motion.mjs";
import { CalendarBlank, CaretLeft, CaretRight } from "./icons.jsx";
import { periodBounds, movePeriod } from "../shared/period.mjs";
const label = (anchor, unit) => {
  const { start, last } = periodBounds(anchor, unit);
  const d = (s) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8))}일`;
  return unit === "month"
    ? `${start.slice(0, 4)}년 ${Number(start.slice(5, 7))}월`
    : `${start.slice(0, 4)}년 ${d(start)} – ${start.slice(0, 4) !== last.slice(0, 4) ? last.slice(0, 4) + "년 " : ""}${d(last)}`;
};
export default function OverviewPeriodPicker({
  anchor,
  unit,
  today,
  onChange,
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState({ anchor, unit });
  const root = useRef(null),
    trigger = useRef(null),
    panel = useRef(null),
    closing = useRef(null),
    id = useId();
  const close = (restore = false) => {
    const finish = () => {
      closing.current = null;
      setOpen(false);
      if (restore) trigger.current?.focus();
    };
    if (!allowUiMotion()) {
      closing.current?.cancel();
      return finish();
    }
    if (closing.current || !panel.current) return;
    const el = panel.current;
    const from = getComputedStyle(el).opacity;
    el.getAnimations().forEach(a => a.cancel());
    const animation = el.animate([{opacity:from},{opacity:0}],{duration:125,easing:uiEase,fill:'forwards'});
    closing.current = animation;
    animation.finished.then(() => { if (closing.current === animation) finish(); }).catch(() => {});
  };
  useEffect(() => {
    if (!open) return;
    if (allowUiMotion()) panel.current?.animate([{opacity:0},{opacity:1}],{duration:160,easing:uiEase});
    panel.current?.querySelector("button")?.focus({ preventScroll: true });
    const outside = (e) => {
      if (!root.current?.contains(e.target)) close();
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      closing.current?.cancel();
      closing.current = null;
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const select = (unit, offset) =>
    setDraft({ unit, anchor: movePeriod(today, unit, offset) });
  return (
    <div
      className="overview-period-picker"
      ref={root}
      onBlur={(e) => {
        if (
          open &&
          e.relatedTarget &&
          !e.currentTarget.contains(e.relatedTarget)
        )
          close();
      }}
    >
      <button
        ref={trigger}
        className="date-pill period-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (open) close();
          else {
            setDraft({ anchor, unit });
            setOpen(true);
          }
        }}
      >
        <CalendarBlank size={16} />
        <span>{label(anchor, unit)}</span>
        <span className="period-trigger-unit">
          {unit === "week" ? "주간" : "월간"}
        </span>
      </button>
      {open && (
        <section
          ref={panel}
          id={id}
          role="dialog"
          aria-label="대시보드 기간 선택"
          className="period-popover"
        >
          <h3>조회 기간</h3>
          <div
            className="period-segment"
            data-unit={draft.unit}
            role="group"
            aria-label="대시보드 집계 단위"
          >
            <button
              aria-pressed={draft.unit === "week"}
              onClick={() => setDraft({ ...draft, unit: "week" })}
            >
              주간
            </button>
            <button
              aria-pressed={draft.unit === "month"}
              onClick={() => setDraft({ ...draft, unit: "month" })}
            >
              월간
            </button>
          </div>
          <div className="period-date-row">
            <button
              className="icon-button"
              aria-label="선택 기간 이전"
              onClick={() =>
                setDraft({
                  ...draft,
                  anchor: movePeriod(draft.anchor, draft.unit, -1),
                })
              }
            >
              <CaretLeft size={18} />
            </button>
            <p className="period-range-label" aria-live="polite">
              {label(draft.anchor, draft.unit)}
            </p>
            <button
              className="icon-button"
              aria-label="선택 기간 다음"
              onClick={() =>
                setDraft({
                  ...draft,
                  anchor: movePeriod(draft.anchor, draft.unit, 1),
                })
              }
            >
              <CaretRight size={18} />
            </button>
          </div>
          <div className="period-current-row">
            <button
              type="button"
              className="period-current"
              disabled={
                periodBounds(draft.anchor, draft.unit).start ===
                periodBounds(today, draft.unit).start
              }
              onClick={() => select(draft.unit, 0)}
            >
              {draft.unit === "week" ? "이번 주" : "이번 달"}
            </button>
          </div>
          <div className="period-popover-actions">
            <button className="button" onClick={() => close(true)}>
              취소
            </button>
            <button
              className="button primary"
              onClick={() => {
                onChange(draft);
                close(true);
              }}
            >
              적용
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
