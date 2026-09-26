"use strict";
const $ = (id) => document.getElementById(id);
const notes = {
  Fillaprint: "Proportional letter widths and kerning.",
  FillaprintTab: "Proportional letters, equal-width digits for measurements in columns.",
  FillaprintMono: "Fixed 12w character cells. Fourteen wider characters are omitted from this family."
};
let coverage;
let coverageSets;
function updatePreview() {
  const family = $("family").value;
  $("preview").textContent = $("sample").value;
  $("preview").style.fontFamily = family;
  $("preview").style.fontSize = `${$("size-slider").value}px`;
  $("preview-size").textContent = `${$("size-slider").value} px`;
  $("preview").classList.toggle("dark", $("dark").checked);
  $("family-note").textContent = notes[family];
  if (coverage) {
    // Sets give O(1) membership checks; a sample can have hundreds of characters and
    // Array.includes would rescan the whole coverage list (hundreds of codepoints) for each one.
    const covered = coverageSets[family];
    const missing = [...new Set([...$("sample").value].filter(c => !"\n\r\t".includes(c) && !covered.has(c.codePointAt(0))))];
    $("coverage-note").textContent = missing.length ? `Not in this family; shown using a fallback font: ${missing.join(" ")}` : "All characters in your sample are included in this family.";
  }
}
for (const id of ["family", "size-slider", "sample", "dark"]) $(id).addEventListener("input", updatePreview);
$("line-width").addEventListener("input", () => {
  const w = $("line-width").valueAsNumber;
  const valid = Number.isFinite(w) && w >= 0.1 && w <= 2;
  $("line-width").setAttribute("aria-invalid", String(!valid));
  for (const [id, multiplier] of [["cap",14],["em",20],["stroke",2],["pitch",28]]) $(id).textContent = valid ? `${(w*multiplier).toFixed(2)} mm` : "—";
  $("size-message").textContent = valid ? `At ${w.toFixed(2)} mm line width, start with a ${(w*14).toFixed(2)} mm capital height.` : "Enter a line width between 0.10 and 2.00 mm.";
});
fetch("coverage.json").then(r => { if (!r.ok) throw new Error("coverage"); return r.json(); }).then(data => {
  coverage = data;
  coverageSets = Object.fromEntries(Object.entries(data).map(([family, codepoints]) => [family, new Set(codepoints)]));
  updatePreview();
}).catch(() => { $("coverage-note").textContent = "Coverage checking is unavailable; unsupported characters may use a fallback font."; });
updatePreview();
