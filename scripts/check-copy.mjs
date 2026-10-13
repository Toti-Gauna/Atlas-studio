// Editorial guard: user-visible strings must not leak engineering vocabulary.
// Scans copy/*.ts string literals and JSX text / user-facing attributes in
// components and features. Engineering detail belongs behind <TechDetails>,
// whose children are exempt. Usage: node scripts/check-copy.mjs
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../apps/web/src/", import.meta.url).pathname;
const BANNED = [
  [/\bcoverage\b/i, "coverage"],
  [/\bthreshold\b/i, "threshold"],
  [/\bBM25\b/, "BM25"],
  [/\bchunks?\b/i, "chunk"],
  [/\bidempoten/i, "idempotency"],
  [/\bFIXTURE\b/, "FIXTURE"],
  [/\bAPI worker\b/i, "API worker"],
  [/\bpending backend\b/i, "pending backend"],
  [/\bClaude Max\b/, "Claude Max"],
  [/\bChatGPT\b/, "ChatGPT"],
  [/\blexical\b/i, "lexical"],
  [/\bbranch(es)?\b/i, "branch"],
  [/\bhash(es)?\b/i, "hash"],
];
const USER_ATTRS = new Set(["title", "label", "placeholder", "aria-label", "description", "body", "summary", "hint", "alt"]);

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

const problems = [];
function check(text, file, node, sf) {
  for (const [re, name] of BANNED) {
    if (re.test(text)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      problems.push(`${relative(root, file)}:${line + 1}  "${name}" in: ${text.trim().slice(0, 90)}`);
    }
  }
}

function insideTechDetails(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxElement(p) && p.openingElement.tagName.getText() === "TechDetails") return true;
  }
  return false;
}

for (const file of [...files(join(root, "copy")), ...files(join(root, "components")), ...files(join(root, "features"))]) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const isCopy = file.includes("/copy/");
  const visit = (node) => {
    if (isCopy && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))) {
      check(node.text, file, node, sf);
    }
    if (!isCopy && ts.isJsxText(node) && node.text.trim() && !insideTechDetails(node)) check(node.text, file, node, sf);
    if (!isCopy && ts.isJsxAttribute(node) && USER_ATTRS.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer) && !insideTechDetails(node)) {
      check(node.initializer.text, file, node, sf);
    }
    // Toasts and similar objects: { title: "…", body: "…" }
    if (!isCopy && ts.isPropertyAssignment(node) && USER_ATTRS.has(node.name.getText()) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
      check(node.initializer.text, file, node, sf);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (problems.length) {
  console.error(`Copy check: ${problems.length} user-visible string(s) use engineering vocabulary:\n`);
  for (const p of problems) console.error("  " + p);
  console.error("\nRephrase for the user, or move the detail inside <TechDetails>.");
  process.exit(1);
}
console.log("Copy check passed.");
