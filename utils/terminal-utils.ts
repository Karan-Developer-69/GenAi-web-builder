/**
 * Generates a terminal-friendly progress bar string.
 * @param percent Number between 0 and 100
 * @param width Width of the progress bar in characters
 * @returns Progress bar string like [████░░░░] 50%
 */
export function generateProgressBar(percent: number, width: number = 20): string {
    const filledCount = Math.round((percent / 100) * width);
    const emptyCount = width - filledCount;

    const bar = '█'.repeat(Math.max(0, filledCount)) + '░'.repeat(Math.max(0, emptyCount));
    return `[${bar}] ${Math.round(percent)}%`;
}

/**
 * Parses Python pip installation logs to extract progress if possible.
 * Look for patterns like "Downloading ... (X.Y MB)" or "1.2/3.4 MB".
 */
export function extractPipProgress(log: string): number | null {
    // Look for (XX%) or XX% patterns in progress logs
    const percentMatch = log.match(/(\d+)%/);
    if (percentMatch) {
        return parseInt(percentMatch[1], 10);
    }

    // Look for 1.2/3.4 MB patterns
    const mbMatch = log.match(/(\d+\.?\d*)\/(\d+\.?\d*)\s*MB/i);
    if (mbMatch) {
        const current = parseFloat(mbMatch[1]);
        const total = parseFloat(mbMatch[2]);
        if (total > 0) {
            return Math.min(100, Math.round((current / total) * 100));
        }
    }

    return null;
}
