import type { CSSProperties } from "react";

export function Slider({
  id,
  min,
  max,
  step,
  value,
  valueText,
  labelledBy,
  onValueChange,
}: {
  id?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Spoken value, with units and what it means. */
  valueText: string;
  labelledBy: string;
  onValueChange: (value: number) => void;
}) {
  const fill = { "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties;

  return (
    <input
      id={id}
      type="range"
      className="slider"
      style={fill}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-labelledby={labelledBy}
      aria-valuetext={valueText}
      onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)}
    />
  );
}
