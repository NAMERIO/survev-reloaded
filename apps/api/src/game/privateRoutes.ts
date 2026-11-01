import { zUpdateRegionBody } from "@survev/contracts";
import { Elysia } from "elysia";
import { updateRegion } from "./regions.ts";

/** /private/update_region: each game server registers its region and reports its player count */
export const GamePrivateRoutes = new Elysia()
    .post("/update_region", { body: zUpdateRegionBody }, ({ body: { regionId, data } }) => {
        updateRegion(regionId, data);
        return {};
    });
