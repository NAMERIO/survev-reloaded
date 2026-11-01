/** the code in a shared /t/<code> link */
export function teamCodeFromPath(pathname: string) {
    return pathname.match(/^\/t\/([^/]+)\/?$/)?.[1] ?? null;
}
