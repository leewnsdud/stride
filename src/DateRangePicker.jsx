import React, { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { CalendarBlank, ArrowsClockwise } from "./icons.jsx";
import { recentDays } from "../shared/period.mjs";

export default function DateRangePicker({
  value,
  today,
  onApply,
  action = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [panelLeft, setPanelLeft] = useState(0);
  const [draft, setDraft] = useState(() => value || recentDays(today));
  const root = useRef(null),
    trigger = useRef(null),
    panel = useRef(null);
  const id = useId();
  const close = (focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const anchor = root.current?.getBoundingClientRect();
      const button = trigger.current?.getBoundingClientRect();
      // Measure layout width independently of any visual transitions.
      const width = panel.current?.offsetWidth;
      if (!anchor || !button || !width) return;
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft || 0) + 16;
      const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 32;
      const preferred = action ? button.right - width : button.left;
      setPanelLeft(Math.max(leftEdge, Math.min(preferred, rightEdge - width)) - anchor.left);
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(root.current);
    observer.observe(panel.current);
    window.addEventListener("resize", position);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [open, action]);
  useEffect(() => {
    if (!open) return;
    // Focusing a date input on open can immediately invoke iOS's native picker.
    // Start at the dialog; Tab or a deliberate tap enters the date field.
    panel.current?.focus({ preventScroll: true });
    const outside = (e) => {
      if (!root.current?.contains(e.target)) close();
    };
    const escape = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const label = action
    ? "활동 동기화"
    : value
      ? `${value.start.replaceAll("-", ".")} – ${value.end.replaceAll("-", ".")}`
      : "전체 기간";
  return (
    <div
      className="overview-period-picker range-picker"
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
        className={action ? "button" : "date-pill period-trigger"}
        ref={trigger}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (open) close();
          else {
            setDraft(value || recentDays(today));
            setOpen(true);
          }
        }}
      >
        {action ? (
          <ArrowsClockwise size={18} className={disabled ? "spin" : ""} />
        ) : (
          <CalendarBlank size={18} />
        )}
        <span>{label}</span>
      </button>
      {open && (
        <form
          ref={panel}
          id={id}
          className="period-popover range-popover"
          style={{ left: panelLeft }}
          role="dialog"
          tabIndex={-1}
          aria-label={action ? "동기화 기간 선택" : "활동 조회 기간 선택"}
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.start && draft.end && draft.start <= draft.end) {
              close(true);
              onApply(draft);
            }
          }}
        >
          <h3>{action ? "동기화 기간" : "조회 기간"}</h3>
          <div className="range-fields">
            <label>
              시작일
              <input
                type="date"
                required
                value={draft.start}
                max={draft.end || today}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label>
              종료일
              <input
                type="date"
                required
                value={draft.end}
                min={draft.start}
                max={today}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
          </div>
          <div className="range-presets">
            {[3, 7, 30].map((n) => (
              <button
                type="button"
                className="text-button"
                key={n}
                onClick={() => setDraft(recentDays(today, n))}
              >
                최근 {n}일
              </button>
            ))}
            {!action && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  close(true);
                  onApply(null);
                }}
              >
                전체 기간
              </button>
            )}
          </div>
          <p className="helper">
            {action
              ? "선택한 기간의 Garmin 활동을 가져옵니다."
              : "시작일과 종료일을 포함한 기록을 보여줍니다."}
          </p>
          <div className="range-footer">
            <button
              className="button"
              type="button"
              onClick={() => close(true)}
            >
              취소
            </button>
            <button
              className="button primary"
              disabled={
                !draft.start ||
                !draft.end ||
                draft.start > draft.end ||
                draft.end > today
              }
            >
              {action ? "동기화 시작" : "적용"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
