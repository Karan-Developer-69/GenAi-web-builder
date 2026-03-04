/**
 * Code Quality Validator
 *
 * Validates AI-generated code for common quality issues:
 * - Missing interactivity (no useState / onClick)
 * - Missing Tailwind class usage
 * - Incomplete placeholder comments
 * - Missing imports for referenced identifiers
 *
 * Returns an array of warning strings. An empty array means the code is clean.
 */
export function validateGeneratedCode(code: string): string[] {
    const warnings: string[] = [];

    // 1. Interactivity check — only applies to React/JSX files
    const isReactFile =
        code.includes('import React') ||
        code.includes("from 'react'") ||
        code.includes('from "react"') ||
        code.includes('.tsx') ||
        code.includes('.jsx') ||
        /<[A-Z][A-Za-z]+/.test(code); // JSX component tag heuristic

    if (isReactFile && !code.includes('useState') && !code.includes('onClick') && !code.includes('onChange')) {
        warnings.push('⚠️ No interactivity detected — consider adding useState and event handlers');
    }

    // 2. Tailwind check — only for frontend files (not Python/plain JS)
    const isFrontendFile = isReactFile || code.includes('className=');
    if (isFrontendFile && !code.includes('className')) {
        warnings.push('⚠️ No Tailwind className found — UI may be unstyled');
    }

    // 3. Placeholder comments — universal check
    const placeholders = [
        '// TODO',
        '// todo',
        '// implement',
        '// IMPLEMENT',
        '// your code here',
        '// add your',
        '// placeholder',
        '/* TODO',
    ];
    for (const p of placeholders) {
        if (code.includes(p)) {
            warnings.push(`❌ Incomplete code detected — found placeholder comment: "${p}"`);
            break; // Report once
        }
    }

    // 4. Hallucinated/unknown import check (basic heuristic)
    const suspiciousImports = [
        'from "@/non-existent',
        'from "react-magic',
        'from "auto-animate', // not widely used, often hallucinated
        "from 'react-spring-magic",
        'from "next-magic',
    ];
    for (const suspect of suspiciousImports) {
        if (code.includes(suspect)) {
            warnings.push(`⚠️ Potentially hallucinated import detected: "${suspect}"`);
        }
    }

    // 5. Incomplete component check — function defined but body is empty
    const emptyBodyRegex = /(?:function|const)\s+\w+[^{]*\{[\s]*\}/g;
    const emptyMatches = code.match(emptyBodyRegex);
    if (emptyMatches && emptyMatches.length > 0) {
        warnings.push(`⚠️ ${emptyMatches.length} empty function body(ies) detected — possible incomplete generation`);
    }

    return warnings;
}

/**
 * Validates an array of generated files and returns a map of path → warnings.
 * Only files with warnings are included in the result.
 */
export function validateGeneratedFiles(
    files: Array<{ path: string; content: string }>
): Record<string, string[]> {
    const results: Record<string, string[]> = {};

    for (const file of files) {
        // Only validate JS/TS/TSX/JSX/Python files
        const isCodeFile = /\.(tsx?|jsx?|py)$/.test(file.path);
        if (!isCodeFile) continue;

        const warnings = validateGeneratedCode(file.content);
        if (warnings.length > 0) {
            results[file.path] = warnings;
        }
    }

    return results;
}
