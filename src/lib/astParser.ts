/**
 * Regex-based import/dependency extractor.
 * Supports JS/TS, Python, CSS/SCSS, and Go.
 */

export type ImportType =
  "esm" | "require" | "dynamic" | "python" | "css" | "go";

export interface ImportInfo {
  source: string;
  type: ImportType;
  items?: string[];
}

const SOURCE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "pyw",
  "css",
  "scss",
  "less",
  "go",
  "rs",
  "rb",
  "java",
  "php",
  "swift",
  "kt",
]);

export function isSourceFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? SOURCE_EXTENSIONS.has(ext) : false;
}

/**
 * Filter out generated/minified artifacts that pollute dependency analysis.
 */
export function isLikelyGeneratedPath(filepath: string): boolean {
  const lower = filepath.toLowerCase();

  if (
    lower.includes("/dist/") ||
    lower.includes("/build/") ||
    lower.includes("/coverage/") ||
    lower.includes("/.next/") ||
    lower.includes("/out/") ||
    lower.includes("/vendor/") ||
    lower.includes("/generated/")
  ) {
    return true;
  }

  if (/\.(min|bundle)\.(js|mjs|cjs|css)$/.test(lower)) {
    return true;
  }

  // e.g. _basePickBy-CbJvnpJd.js or app.8f2d3a1c.js
  if (/[-._][a-z0-9]{7,}\.(js|mjs|cjs|css)$/.test(lower)) {
    return true;
  }

  return false;
}

/** Strip comments and string literals before import regex matching. */
function stripForParsing(content: string, lang: "js" | "python" | "css-go"): string {
  if (lang === "python") return stripPython(content);
  if (lang === "css-go") return stripBlockAndLineComments(content);
  return stripJS(content);
}

function stripJS(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    // Block comment
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i += 2;
      result += " ";
      continue;
    }

    // Line comment
    if (ch === "/" && next === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      result += "\n";
      continue;
    }

    // Template literal — collapse contents
    if (ch === "`") {
      i++;
      while (i < content.length) {
        if (content[i] === "\\") {
          i += 2;
          continue;
        }
        if (content[i] === "`") {
          i++;
          break;
        }
        i++;
      }
      result += "``";
      continue;
    }

    // Preserve only import-source strings. Generic string content is blanked
    // so prose containing `import "..."` cannot become a dependency edge.
    if (ch === "'" || ch === '"') {
      const lineStart = content.lastIndexOf("\n", i) + 1;
      const before = content.slice(lineStart, i);
      const isImportSource = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)$/.test(before);
      const quote = ch;
      let stringValue = ch;
      i++;
      while (i < content.length) {
        if (content[i] === "\\") {
          if (isImportSource) stringValue += content[i] + (content[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (isImportSource) stringValue += content[i];
        if (content[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      result += isImportSource ? stringValue : '""';
      continue;
    }

    result += ch;
    i++;
  }
  return result;
}

function stripPython(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];
    const next2 = content[i + 2];

    // Triple-quoted strings / docstrings
    if (
      (ch === "'" && next === "'" && next2 === "'") ||
      (ch === '"' && next === '"' && next2 === '"')
    ) {
      const quote = ch;
      i += 3;
      while (i < content.length) {
        if (
          content[i] === quote &&
          content[i + 1] === quote &&
          content[i + 2] === quote
        ) {
          i += 3;
          break;
        }
        i++;
      }
      result += '"""';
      continue;
    }

    // Single/double quoted strings
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < content.length) {
        if (content[i] === "\\") {
          i += 2;
          continue;
        }
        if (content[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      result += '""';
      continue;
    }

    // Line comment
    if (ch === "#") {
      while (i < content.length && content[i] !== "\n") i++;
      result += "\n";
      continue;
    }

    result += ch;
    i++;
  }
  return result;
}

function stripBlockAndLineComments(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i += 2;
      result += " ";
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      result += "\n";
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const lineStart = content.lastIndexOf("\n", i) + 1;
      const before = content.slice(lineStart, i);
      const isImportSource =
        /(?:@import\s+(?:url\s*\(\s*)?|\bimport\s*(?:\(\s*)?)$/.test(before) ||
        /\bimport\s*\([^)]*$/.test(content.slice(0, i));
      let stringValue = isImportSource ? ch : '""';
      i++;
      while (i < content.length) {
        if (content[i] === "\\") {
          if (isImportSource) stringValue += content[i] + (content[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (isImportSource) stringValue += content[i];
        if (content[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      result += stringValue;
      continue;
    }

    result += ch;
    i++;
  }
  return result;
}

export function extractImports(content: string, filepath: string): ImportInfo[] {
  const ext = filepath.split(".").pop()?.toLowerCase() ?? "";

  if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext)) {
    return extractJSImports(stripForParsing(content, "js"));
  }
  if (["py", "pyw"].includes(ext)) {
    return extractPythonImports(stripForParsing(content, "python"));
  }
  if (["css", "scss", "less"].includes(ext)) {
    return extractCSSImports(stripForParsing(content, "css-go"));
  }
  if (ext === "go") {
    return extractGoImports(stripForParsing(content, "css-go"));
  }
  return [];
}

function extractJSImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const seen = new Set<string>();

  const add = (source: string, type: ImportType, items?: string[]) => {
    if (!seen.has(source + type)) {
      seen.add(source + type);
      imports.push({ source, type, items });
    }
  };

  // ESM static: import ... from '...'
  const esmFrom =
    /import\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = esmFrom.exec(content)) !== null) {
    add(m[1], "esm");
  }

  // ESM side-effect: import '...'
  const esmSideEffect = /^import\s+['"]([^'"]+)['"]/gm;
  while ((m = esmSideEffect.exec(content)) !== null) {
    add(m[1], "esm");
  }

  // CommonJS: require('...')
  const cjs = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = cjs.exec(content)) !== null) {
    add(m[1], "require");
  }

  // Dynamic: import('...')
  const dyn = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dyn.exec(content)) !== null) {
    add(m[1], "dynamic");
  }

  return imports;
}

function extractPythonImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const seen = new Set<string>();

  const add = (source: string, items?: string[]) => {
    if (!seen.has(source)) {
      seen.add(source);
      imports.push({ source, type: "python", items });
    }
  };

  // from X import Y, Z
  const fromImport = /^from\s+([\w.]+)\s+import\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = fromImport.exec(content)) !== null) {
    const items = m[2].split(",").map((s) => s.trim().split(" as ")[0].trim());
    add(m[1], items);
  }

  // import X (as Y), W
  const plainImport = /^import\s+([\w.,\s]+)$/gm;
  while ((m = plainImport.exec(content)) !== null) {
    const modules = m[1]
      .split(",")
      .map((s) => s.trim().split(" as ")[0].trim());
    modules.forEach((mod) => add(mod));
  }

  return imports;
}

function extractCSSImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const pattern = /@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content)) !== null) {
    imports.push({ source: m[1], type: "css" });
  }
  return imports;
}

function extractGoImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const seen = new Set<string>();

  // Single: import "pkg"
  const single = /^import\s+"([^"]+)"/gm;
  let m: RegExpExecArray | null;
  while ((m = single.exec(content)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      imports.push({ source: m[1], type: "go" });
    }
  }

  // Block: import ( "pkg1" "pkg2" )
  const blockMatch = /import\s*\(([\s\S]*?)\)/g;
  while ((m = blockMatch.exec(content)) !== null) {
    const block = m[1];
    const pkgPattern = /(?:[\w]+\s+)?["']([^"']+)["']/g;
    let p: RegExpExecArray | null;
    while ((p = pkgPattern.exec(block)) !== null) {
      if (!seen.has(p[1])) {
        seen.add(p[1]);
        imports.push({ source: p[1], type: "go" });
      }
    }
  }

  return imports;
}

/**
 * Normalize a file path (resolve . and ..)
 */
export function normalizePath(path: string): string {
  const parts = path.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "..") result.pop();
    else if (part !== ".") result.push(part);
  }
  return result.join("/");
}

/**
 * Resolve an import path relative to the importing file.
 * Returns null if it's an external/npm module.
 */
export function resolveImportPath(
  importPath: string,
  importerFilePath: string,
  allFilePaths: string[],
  aliases: Record<string, string> = { "@/": "src/" },
): string | null {
  const matchedAlias = Object.entries(aliases)
    .sort(([a], [b]) => b.length - a.length)
    .find(([alias]) => importPath.startsWith(alias));

  const importerExt = importerFilePath.split(".").pop()?.toLowerCase();
  const isPythonImporter = importerExt === "py" || importerExt === "pyw";
  const isPythonAbsoluteModule =
    isPythonImporter &&
    /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/.test(importPath);

  // Skip node_modules and unresolved non-relative imports. Python absolute
  // package imports are the one exception: they are resolved only from roots
  // proven by files already present in this repository.
  if (
    !importPath.startsWith(".") &&
    !importPath.startsWith("/") &&
    !matchedAlias &&
    !isPythonAbsoluteModule
  ) {
    return null;
  }

  const importerDir = importerFilePath.split("/").slice(0, -1).join("/");

  let bases: string[];
  if (matchedAlias) {
    const [alias, target] = matchedAlias;
    bases = [target + importPath.slice(alias.length)];
  } else if (importPath.startsWith("/")) {
    bases = [importPath.slice(1)];
  } else if (isPythonAbsoluteModule) {
    const modulePath = importPath.replaceAll(".", "/");
    const packageName = modulePath.split("/")[0];
    const roots = inferPythonSourceRoots(allFilePaths, packageName);
    if (roots.length === 0) return null;
    bases = roots.map((root) => (root ? `${root}/${modulePath}` : modulePath));
  } else {
    bases = [importerDir ? `${importerDir}/${importPath}` : importPath];
  }

  for (const base of bases) {
    const resolved = normalizePath(base);
    const match = resolveFileCandidate(resolved, allFilePaths, isPythonImporter);
    if (match) return match;
  }

  return null;
}

function inferPythonSourceRoots(allFilePaths: string[], packageName: string): string[] {
  const roots = new Set<string>();
  for (const filepath of allFilePaths) {
    const parts = filepath.split("/");
    const packageIndex = parts.indexOf(packageName);
    if (packageIndex >= 0) roots.add(parts.slice(0, packageIndex).join("/"));
  }
  return [...roots];
}

function resolveFileCandidate(
  resolved: string,
  allFilePaths: string[],
  pythonOnly: boolean,
): string | null {
  if (allFilePaths.includes(resolved)) return resolved;
  const extensions = pythonOnly
    ? [".py", ".pyw"]
    : [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".css", ".scss", ".less", ".go", ".json", ".vue", ".svelte"];
  for (const ext of extensions) if (allFilePaths.includes(resolved + ext)) return resolved + ext;
  for (const ext of extensions) {
    const indexName = pythonOnly ? "/__init__" + ext : "/index" + ext;
    if (allFilePaths.includes(resolved + indexName)) return resolved + indexName;
  }
  return null;
}
