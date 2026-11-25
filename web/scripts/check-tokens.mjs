// Fails if tokens.css and tokens.ts disagree, if a color pair misses its contrast
// floor, or if a component uses a raw color or an unnamed transition.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { colors, curves, durations, radii, typeStyles } from "../src/design/tokens.ts";
import { contrast } from "../src/design/contrast.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/app/tokens.css"), "utf8");
const problems = [];

const cssValue = (name) => {
  const match = css.match(new RegExp(`--${name.replace(/[-]/g, "\\-")}:\\s*([^;]+);`));
  return match ? match[1].trim().replace(/\s+/g, " ") : undefined;
};
const expect = (name, wanted) => {
  const found = cssValue(name);
  if (found?.toLowerCase() !== String(wanted).toLowerCase()) {
    problems.push(`--${name} is ${found ?? "missing"} in tokens.css but ${wanted} in tokens.ts`);
  }
};

for (const color of colors) expect(`color-${color.name}`, color.hex);
for (const style of typeStyles) {
  expect(`text-${style.name}`, `${style.size}px`);
  expect(`text-${style.name}--line-height`, `${style.line}px`);
  expect(`text-${style.name}--letter-spacing`, style.tracking);
  expect(`text-${style.name}--font-weight`, style.weight);
}
for (const radius of radii) expect(`radius-${radius.name}`, `${radius.px}px`);
for (const curve of curves) expect(curve.name, `cubic-bezier(${curve.points.join(", ")})`);
for (const duration of durations) expect(`dur-${duration.name}`, `${duration.ms}ms`);

const cssColors = [...css.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1]);
for (const name of cssColors) {
  if (!colors.some((color) => color.name === name)) problems.push(`--color-${name} is not listed in tokens.ts`);
}

const hexOf = (name) => colors.find((color) => color.name === name)?.hex;
for (const color of colors) {
  if (!color.measure) continue;
  const other = hexOf(color.measure.against);
  if (!other) {
    problems.push(`${color.name} is measured against unknown role ${color.measure.against}`);
    continue;
  }
  const ratio = contrast(color.hex, other);
  if (ratio < color.measure.min) {
    problems.push(`${color.name} is ${ratio.toFixed(2)}:1 ${color.measure.label}, below ${color.measure.min}:1`);
  }
}

const allowed = new Set(["src/app/tokens.css", "src/design/tokens.ts"]);
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
for (const file of walk(join(root, "src"))) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (allowed.has(path) || !/\.(tsx?|css)$/.test(path)) continue;
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    const where = `${path}:${index + 1}`;
    if (/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i.test(line) || /\b(?:rgba?|hsla?|oklch)\(/i.test(line)) {
      problems.push(`${where} uses a raw color`);
    }
    if (/transition-all|transition:\s*all/.test(line)) problems.push(`${where} transitions every property`);
    if (/font-(?:semibold|bold|extrabold|black)\b/.test(line)) problems.push(`${where} uses a weight above 500`);
  });
}

if (problems.length > 0) {
  console.error(problems.map((problem) => `- ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`Tokens match: ${colors.length} colors, ${typeStyles.length} type styles, ${radii.length} radii.`);
