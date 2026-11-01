/** names are user input: shrink to the column instead of clipping. Weights are rough glyph widths in em */
export function fitFontSize(text: string, max: number, budget: number) {
    let width = 0;
    for (const char of text) {
        if (/[WMwm@]/.test(char)) width += 0.82;
        else if (char.charCodeAt(0) > 0x2e80) width += 1;
        else width += 0.55;
    }
    return width ? Math.min(max, Math.floor(budget / width)) : max;
}
