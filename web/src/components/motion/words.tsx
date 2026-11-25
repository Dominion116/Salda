import { Fragment, type CSSProperties } from "react";

/**
 * Splits text into word spans so they can arrive one by one. The words and spaces stay in
 * reading order, so screen readers read the sentence normally.
 */
export function Words({ text, start = 0 }: { text: string; start?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={index}>
          <span className="word" style={{ "--w": start + index } as CSSProperties}>
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

export const wordCount = (text: string) => text.split(" ").length;

/** One span per letter, for the footer wordmark. Decorative only. */
export function Letters({ text }: { text: string }) {
  return (
    <>
      {[...text].map((letter, index) => (
        <span key={index} className="word" style={{ "--w": index } as CSSProperties}>
          {letter}
        </span>
      ))}
    </>
  );
}
