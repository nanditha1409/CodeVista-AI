/** Count non-blank source lines after removing comments for the file's syntax. */
export function countSourceLines(content: string, filename: string): number {
  const lowerName = filename.toLowerCase();
  const extension = lowerName.slice(lowerName.lastIndexOf("."));
  const isMarkup = [".html", ".xml", ".vue", ".svelte", ".md", ".mdx"].includes(extension);
  const isLua = extension === ".lua";
  const usesHashComments = [
    ".py", ".pyw", ".sh", ".bash", ".zsh", ".rb", ".r", ".yaml", ".yml",
    ".toml", ".tf", ".php", ".graphql", ".gql",
  ].includes(extension) || ["dockerfile", "makefile", ".gitignore", ".env", ".env.example", ".env.local"].includes(lowerName);
  const usesSqlComments = extension === ".sql";
  const usesCComments = ![
    ".py", ".pyw", ".sh", ".bash", ".zsh", ".rb", ".r", ".yaml", ".yml",
    ".toml", ".lua", ".md", ".mdx", ".json",
  ].includes(extension);

  let count = 0;
  let hasCode = false;
  let quote: "'" | '"' | "`" | null = null;
  let blockEnd: string | null = null;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === "\n") {
      if (hasCode) count++;
      hasCode = false;
      continue;
    }

    if (blockEnd) {
      if (content.startsWith(blockEnd, i)) {
        i += blockEnd.length - 1;
        blockEnd = null;
      }
      continue;
    }

    if (quote) {
      hasCode = true;
      if (char === "\\") {
        i++;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (isMarkup && content.startsWith("<!--", i)) {
      blockEnd = "-->";
      i += 3;
      continue;
    }
    if (isLua && content.startsWith("--[[", i)) {
      blockEnd = "]]";
      i += 3;
      continue;
    }
    if (extension === ".rb" && content.startsWith("=begin", i) && (i === 0 || content[i - 1] === "\n")) {
      blockEnd = "=end";
      i += 5;
      continue;
    }
    if (usesCComments && char === "/" && next === "*") {
      blockEnd = "*/";
      i++;
      continue;
    }
    if ((usesCComments && char === "/" && next === "/") ||
        (usesSqlComments && char === "-" && next === "-") ||
        (isLua && char === "-" && next === "-") ||
        (usesHashComments && char === "#")) {
      while (i < content.length && content[i] !== "\n") i++;
      i--;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char as "'" | '"' | "`";
      hasCode = true;
    } else if (!/\s/.test(char)) {
      hasCode = true;
    }
  }

  return hasCode ? count + 1 : count;
}
