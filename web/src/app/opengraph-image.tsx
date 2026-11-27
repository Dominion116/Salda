import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { colors } from "@/design/tokens";

/*
 * The link preview shown on Discord, X, DoraHacks and chat apps. Rendered once at build time from the brand
 * tokens and the logo, so it always matches the site.
 */

export const alt = "Salda: three shops owe each other 15.00, and 2.00 settles all of it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const color = (name: string) => colors.find((token) => token.name === name)?.hex ?? "";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/salda-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  const stat = (value: string, label: string, accent = false) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", fontSize: 56, letterSpacing: -2, color: accent ? color("primary") : color("ink-strong") }}>
        {value}
      </div>
      <div style={{ display: "flex", fontSize: 24, color: color("ink-subtle") }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: color("canvas"),
          color: color("ink-strong"),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" width={168} height={64} />
          <div
            style={{
              display: "flex",
              fontSize: 22,
              padding: "8px 18px",
              borderRadius: 999,
              border: `1px solid ${color("hairline-strong")}`,
              color: color("ink"),
            }}
          >
            QDay Aevum testnet
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.02, letterSpacing: -3, maxWidth: 980 }}>
            Settle what you owe each other with less cash
          </div>
          <div style={{ display: "flex", fontSize: 30, color: color("ink"), maxWidth: 940 }}>
            Salda cancels the debts in a group of businesses and moves only the difference, in one settlement.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 72,
            paddingTop: 28,
            borderTop: `1px solid ${color("hairline")}`,
          }}
        >
          {stat("15.00", "owed between three shops")}
          {stat("2.00", "settles all of it", true)}
          {stat("12.00", "clears with no cash")}
        </div>
      </div>
    ),
    size,
  );
}
