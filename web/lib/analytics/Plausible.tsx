import Script from "next/script";

export function Plausible() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";
  if (!domain) return null;
  return (
    <Script
      src={src}
      data-domain={domain}
      strategy="afterInteractive"
      data-testid="plausible-script"
    />
  );
}
