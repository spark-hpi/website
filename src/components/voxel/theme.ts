export interface ThemeWatcher {
  dispose(): void;
}

export function watchFg(onChange: (fg: string) => void): ThemeWatcher {
  const read = () => getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#11053b";

  let last = read();
  const fire = () => {
    const next = read();
    if (next !== last) { last = next; onChange(next); }
  };

  const mo = new MutationObserver(fire);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });

  const mql = matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", fire);

  const poll = setInterval(fire, 500);

  return {
    dispose() {
      mo.disconnect();
      mql.removeEventListener("change", fire);
      clearInterval(poll);
    },
  };
}
