import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatDuration } from "../shared/time.mjs";
import "./duration-fields.css";

const units = ["시간", "분", "초"];
const split = (value) =>
  value == null
    ? ["", "", ""]
    : [
        Math.floor(value / 3600),
        Math.floor((value % 3600) / 60),
        Math.round(value) % 60,
      ].map(String);
const secondsOf = (parts) =>
  Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
const rowHeight = 40;

function Wheel({ value, max, label, onChange }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    ref.current.scrollTop = value * rowHeight;
  }, []);
  const choose = (next) => {
    const n = Math.max(0, Math.min(max, next));
    ref.current.scrollTo({ top: n * rowHeight, behavior: "instant" });
    onChange(n);
  };
  return (
    <div className="duration-wheel-column">
      <span className="duration-wheel-unit">{label}</span>
      <div
        ref={ref}
        className="duration-wheel"
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} ${label}`}
        onScroll={(e) =>
          onChange(
            Math.max(
              0,
              Math.min(max, Math.round(e.currentTarget.scrollTop / rowHeight)),
            ),
          )
        }
        onKeyDown={(e) => {
          const next = {
            ArrowUp: value + 1,
            ArrowDown: value - 1,
            PageUp: value + 5,
            PageDown: value - 5,
            Home: 0,
            End: max,
          }[e.key];
          if (next !== undefined) {
            e.preventDefault();
            choose(next);
          }
        }}
      >
        {Array.from({ length: max + 1 }, (_, n) => (
          <div
            key={n}
            className="duration-wheel-row"
            aria-hidden="true"
            onClick={() => choose(n)}
          >
            <span
              style={{
                transform: `perspective(180px) rotateX(${Math.max(-65, Math.min(65, (value - n) * 24))}deg)`,
                opacity: Math.abs(n - value) > 1 ? 0.3 : n === value ? 1 : 0.6,
              }}
            >
              {n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Seconds throughout. Local text drafts preserve deliberate empty fields while editing.
export default function DurationFields({
  value,
  onChange,
  label,
  required = false,
  maxHours = 50,
}) {
  const total = value == null ? null : Math.round(Number(value));
  const [parts, setParts] = useState(() => split(total));
  const emitted = useRef(total);
  const [wheel, setWheel] = useState(null);
  const trigger = useRef(null);
  const id = useId();
  useEffect(() => {
    if (total !== emitted.current) {
      setParts(split(total));
      emitted.current = total;
    }
  }, [total]);
  const commit = (next) => {
    setParts(next);
    const seconds = secondsOf(next) || null;
    emitted.current = seconds;
    onChange(seconds);
  };
  const close = () => {
    setWheel(null);
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <div
      className="duration-control"
      role="group"
      aria-label={label}
      onKeyDown={(e) => {
        if (wheel !== null && e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="duration-input">
        {units.map((unit, i) => (
          <label key={unit}>
            <input
              aria-label={`${label} ${unit}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required={required && i === 0}
              value={parts[i]}
              onFocus={(e) => {
                if (e.target.value === "0") e.target.select();
              }}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                const normalized =
                  raw === ""
                    ? ""
                    : String(Math.min(i === 0 ? maxHours : 59, Number(raw)));
                e.target.value = normalized;
                const next = [...parts];
                next[i] = normalized;
                commit(next);
              }}
            />
            <span>{unit}</span>
          </label>
        ))}
      </div>
      <button
        ref={trigger}
        type="button"
        className="duration-wheel-toggle"
        aria-expanded={wheel !== null}
        aria-controls={id}
        onClick={() => setWheel(wheel === null ? parts.map(Number) : null)}
      >
        스크롤로 선택
      </button>
      {wheel !== null && (
        <div
          id={id}
          className="duration-picker"
          role="group"
          aria-label={`${label} 스크롤 선택`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
        >
          <div className="duration-picker-heading">
            <strong>{label}</strong>
            <span>
              {formatDuration(secondsOf(wheel), { forceHours: true })}
            </span>
          </div>
          <div className="duration-wheels">
            {units.map((unit, i) => (
              <Wheel
                key={unit}
                label={unit}
                value={wheel[i]}
                max={i === 0 ? maxHours : 59}
                onChange={(n) =>
                  setWheel((current) => {
                    if (!current || current[i] === n) return current;
                    const next = [...current];
                    next[i] = n;
                    return next;
                  })
                }
              />
            ))}
          </div>
          <div className="duration-picker-actions">
            {!required && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  commit(["", "", ""]);
                  close();
                }}
              >
                비우기
              </button>
            )}
            <button type="button" className="button" onClick={close}>
              취소
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                commit(wheel.map(String));
                close();
              }}
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
