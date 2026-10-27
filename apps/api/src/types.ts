/**
 * Type-only entry point, exported as `@survev/api/types`.
 * Other apps use these to type their Eden clients; this module must only contain types
 * so importing it never pulls API runtime code (drizzle, elysia server) into their bundles.
 */
export type { PrivateRouteApp } from "./app.ts";
export type { UserRouterApp } from "./user/routes.ts";
