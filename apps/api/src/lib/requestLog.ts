/** what the http.request log needs that only the route hooks know, by request */
export type RequestInfo = { route?: string; userId?: string };

const infos = new WeakMap<Request, RequestInfo>();

export function trackRequest(request: Request): RequestInfo {
    const info: RequestInfo = {};
    infos.set(request, info);
    return info;
}

/** a no-op for requests that aren't tracked (websocket upgrades) */
export function noteRequest(request: Request, info: RequestInfo) {
    const tracked = infos.get(request);
    if (tracked) Object.assign(tracked, info);
}
