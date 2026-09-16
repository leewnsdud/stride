import React from "react";
// Stored seconds; display and edit without fractional-minute conversion.
export default function DurationFields({
  value,
  onChange,
  label,
  required = false,
  maxHours = 50,
}) {
  const total = value == null ? null : Math.round(Number(value));
  const values =
    total == null
      ? ["", "", ""]
      : [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return (
    <div className="duration-input" role="group" aria-label={label}>
      {["시간", "분", "초"].map((unit, i) => (
        <label key={unit}>
          <input
            aria-label={`${label} ${unit}`}
            type="number"
            min="0"
            max={i === 0 ? maxHours : 59}
            step="1"
            required={required && i === 0}
            value={values[i]}
            onChange={(e) => {
              const parts = values.map(Number);
              parts[i] = e.target.value === "" ? 0 : Number(e.target.value);
              const seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
              onChange(seconds || null);
            }}
          />
          <span>{unit}</span>
        </label>
      ))}
    </div>
  );
}
