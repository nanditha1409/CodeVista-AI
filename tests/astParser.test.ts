import assert from "node:assert/strict";
import { extractImports, resolveImportPath } from "../src/lib/astParser.ts";
import { countSourceLines } from "../src/lib/lineCounter.ts";

const importer = "backend/app/main.py";
const source = "from app.core.config import settings\n";
const files = [importer, "backend/app/core/config.py"];
const imports = extractImports(source, importer);

assert.equal(imports.length, 1);
assert.equal(imports[0].source, "app.core.config");
assert.equal(
  resolveImportPath(imports[0].source, importer, files),
  "backend/app/core/config.py",
);

console.log("Python absolute import resolution: passed");

assert.equal(
  resolveImportPath(
    "@/components/Foo",
    "frontend/src/main.ts",
    ["frontend/src/main.ts", "frontend/src/components/Foo.ts"],
    { "@/": "frontend/src/" },
  ),
  "frontend/src/components/Foo.ts",
);

console.log("Merged tsconfig alias resolution: passed");

assert.equal(
  countSourceLines(
    "// comment\n\n  \n/* block comment\n * continuation\n */\nconst x = 10; // comment\nif (x) {\n}\n",
    "example.ts",
  ),
  3,
);
assert.equal(countSourceLines("# comment\nvalue = 1  # comment\n", "example.py"), 1);
assert.equal(countSourceLines("<!-- comment -->\n<div>content</div>\n", "example.html"), 1);
assert.equal(countSourceLines("# comment\ntype Query { name: String }\n", "schema.graphql"), 1);

console.log("Implementation line counting: passed");
