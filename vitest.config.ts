import { defineConfig } from "vitest/config";
import path from "path";
import type { Plugin } from "vite";

// Vitest 2->4 compat: wraps ALL const MockXxx/mockXxx top-level declarations
// into a single vi.hoisted() call so they are accessible inside vi.mock factories.
// Reproduces the automatic prefix-based hoisting removed in Vitest 3+.
// enforce "pre" = runs before the Vitest native transform.
function hoistMockVariablesPlugin(): Plugin {
  return {
    name: "vitest:hoist-mock-variables-compat",
    enforce: "pre",
    transform(code: string, id: string) {
      if (!/\.test\.[jt]sx?$/.test(id)) return null;
      if (!/vi\.mock\s*\(/.test(code)) return null;
      if (!/const\s+(?:Mock|mock)[A-Z]/.test(code)) return null;

      // Extract ALL const MockXxx/mockXxx declarations from the entire file
      const declarations = extractMockDeclarations(code);
      if (declarations.length === 0) return null;

      const varNames = declarations.map((d) => d.name);
      const declCode = declarations.map((d) => d.code).join("\n");

      // Remove original declarations from code (replace with empty string)
      let newCode = code;
      // Process in reverse order to preserve indices
      const sorted = [...declarations].sort((a, b) => b.startIdx - a.startIdx);
      for (const d of sorted) {
        newCode = newCode.slice(0, d.startIdx) + newCode.slice(d.endIdx);
      }

      // Find insertion point: just before the first vi.mock call
      const insertIdx = newCode.indexOf("vi.mock(");
      if (insertIdx === -1) return null;

      // Build vi.hoisted() block
      const hoistedBlock =
        `const { ${varNames.join(", ")} } = vi.hoisted(() => {\n` +
        declCode.split("\n").map((l) => "  " + l).join("\n").trimEnd() + "\n" +
        `  return { ${varNames.join(", ")} };\n` +
        `});\n`;

      newCode = newCode.slice(0, insertIdx) + hoistedBlock + newCode.slice(insertIdx);
      return { code: newCode, map: null };
    },
  };
}

function extractMockDeclarations(
  code: string,
): Array<{ name: string; code: string; startIdx: number; endIdx: number }> {
  const result: Array<{ name: string; code: string; startIdx: number; endIdx: number }> = [];
  const startPattern = /(?:^|\n)(const\s+((?:Mock|mock)[A-Za-z_$0-9]+)\s*=)/g;
  let m: RegExpExecArray | null;
  while ((m = startPattern.exec(code)) !== null) {
    const declStart = m.index === 0 ? 0 : m.index + 1;
    const varName = m[2];
    const eqPos = declStart + m[1].length - 1;
    const declEnd = findDeclarationEnd(code, eqPos);
    if (declEnd === -1) continue;
    // Include trailing newline if present
    const endWithNl = declEnd < code.length && code[declEnd] === "\n" ? declEnd + 1 : declEnd;
    const declCode = code.slice(declStart, declEnd).trimEnd();
    result.push({ name: varName, code: declCode, startIdx: declStart, endIdx: endWithNl });
  }
  return result;
}

function findDeclarationEnd(code: string, fromIdx: number): number {
  let depth = 0;
  let i = fromIdx;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "(" || ch === "{" || ch === "[") {
      depth++;
    } else if (ch === ")" || ch === "}" || ch === "]") {
      depth--;
    } else if (ch === ";" && depth === 0) {
      return i + 1;
    }
    i++;
  }
  return -1;
}


// Shared path aliases
const sharedAlias = {
  "@": path.resolve(import.meta.dirname, "client", "src"),
  "@shared": path.resolve(import.meta.dirname, "shared"),
};

export default defineConfig({
  plugins: [hoistMockVariablesPlugin()],
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "dist/**",
        "*.config.*",
        "tests/setup.ts",
        "client/src/main.tsx",
        "server/index.ts",
        "node_modules/**",
        ".docker/**",
        "drizzle.config.ts",
        "postcss.config.js",
        "tailwind.config.ts",
      ],
    },
    // Multi-env config via projects (recommended in Vitest 3)
    // Projet "client" : jsdom pour les composants React
    // Projet "server" : node pour les tests Express/supertest
    projects: [
      {
        extends: true,
        oxc: {
          jsx: { runtime: "automatic" },
        },
        test: {
          name: "client",
          environment: "jsdom",
          include: ["tests/client/**/*.test.{ts,tsx}", "client/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/setup.ts"],
          resolve: {
            alias: sharedAlias,
          },
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: [
            "tests/*.test.ts",
            "tests/server/**/*.test.ts",
            "tests/shared/**/*.test.ts",
            "server/**/*.test.ts",
            "shared/**/*.test.ts",
          ],
          // Pas de setupFiles avec window/matchMedia pour l'env node
        },
      },
    ],
  },
  resolve: {
    alias: sharedAlias,
  },
});
