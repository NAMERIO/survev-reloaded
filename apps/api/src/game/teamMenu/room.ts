import type { FindGamePrivateBody } from "@survev/contracts";
import { getLogger } from "@survev/logger/node.ts";
import type { FindGamePrivateError } from "@survev/shared/types/api.ts";
import type {
    ClientRoomData,
    ClientToServerTeamMsg,
    RoomData,
    TeamMenuErrorType,
    TeamPlayGameMsg,
} from "@survev/shared/types/team.ts";
import { util } from "@survev/shared/utils/util.ts";
import { randomUUID } from "node:crypto";
import { settings } from "../../admin/settings.ts";
import { verifyTurnstile } from "../../lib/ip.ts";
import { findGame, getFindGamePlayerData, isRegion, regionIds } from "../regions.ts";
import type { Player } from "./player.ts";
import type { TeamMenu } from "./teamMenu.ts";

const logger = getLogger(["api", "team-menu"]);

export class Room {
    players: Player[] = [];

    data: RoomData = {
        roomUrl: "",
        findingGame: false,
        lastError: undefined,
        region: "",
        autoFill: true,
        enabledGameModeIdxs: [],
        gameModeIdx: 1,
        maxPlayers: 4,
        captchaEnabled: false,
    };

    constructor(
        public teamMenu: TeamMenu,
        public id: string,
        initialData: ClientRoomData,
    ) {
        this.data.roomUrl = `#${id}`;
        this.data.captchaEnabled = settings.captchaEnabled;

        this.setProps(initialData);
    }

    addPlayer(player: Player) {
        if (this.players.length >= this.data.maxPlayers) return;

        this.players.push(player);
        player.room = this;

        clearTimeout(player.disconnectTimeout);

        this.sendState();
    }

    onMsg(player: Player, msg: ClientToServerTeamMsg) {
        if (player.room !== this) return;

        player.lastMsgTime = Date.now();
        switch (msg.type) {
            case "changeName": {
                player.setName(msg.data.name);
                this.sendState();
                break;
            }
            case "keepAlive": {
                player.send("keepAlive", {});
                break;
            }
            case "gameComplete": {
                player.inGame = false;
                this.sendState();
                break;
            }
            case "setRoomProps": {
                if (!player.isLeader) break;
                this.setProps(msg.data);
                break;
            }
            case "kick": {
                if (!player.isLeader) break;
                this.kick(msg.data.playerId);
                break;
            }
            case "playGame": {
                if (!player.isLeader) break;
                this.findGame(msg.data).catch((err) => {
                    logger.error("team.find_game_failed", { err });
                    this.data.lastError = "find_game_error";
                    this.sendState();
                });
                break;
            }
        }
    }

    setProps(props: ClientRoomData) {
        let region = props.region;
        if (!isRegion(region)) {
            region = regionIds()[0] ?? region;
        }
        this.data.region = region;

        // modes can be disabled while the room is open
        const allowed = this.teamMenu.allowedGameModeIdxs();
        this.data.enabledGameModeIdxs = allowed;

        const gameModeIdx = allowed.includes(props.gameModeIdx)
            ? props.gameModeIdx
            // none left: the room stays on its mode, findGame reports the error
            : (allowed[0] ?? this.data.gameModeIdx);

        this.data.gameModeIdx = gameModeIdx;

        this.data.maxPlayers = settings.modes[gameModeIdx].teamMode;
        this.data.autoFill = props.autoFill;

        // kick players that don't fit on the new max players
        while (this.players.length > this.data.maxPlayers) {
            this.kick(this.players.length - 1);
        }

        this.sendState();
    }

    kick(playerId: number) {
        const player = this.players[playerId];
        if (!player) return;

        player.send("kicked", {});

        this.removePlayer(player);
    }

    removePlayer(player: Player) {
        if (!util.removeFrom(this.players, player)) {
            return;
        }

        player.room = undefined;
        player.socket.close();

        this.sendState();

        if (!this.players.length) {
            this.teamMenu.removeRoom(this);
        }
    }

    findGameCooldown = 0;

    async findGame(data: TeamPlayGameMsg["data"]) {
        if (this.data.findingGame) return;
        if (this.players.some((p) => p.inGame)) return;
        const roomLeader = this.players[0];
        if (!roomLeader) return;

        this.data.findingGame = true;
        this.sendState();

        let region = data.region;
        if (!isRegion(region)) {
            region = regionIds()[0] ?? region;
        }
        this.data.region = region;

        const mode = settings.modes[this.data.gameModeIdx];
        if (!mode?.enabled) {
            this.data.lastError = "find_game_error";
            this.sendState();
            return;
        }

        if (this.data.captchaEnabled) {
            if (!data.turnstileToken) {
                this.data.lastError = "find_game_invalid_captcha";
                this.sendState();
                return;
            }

            const captcha = await verifyTurnstile(data.turnstileToken, roomLeader.ip);
            if (captcha.isErr() || !captcha.value) {
                this.data.lastError = captcha.isErr() ? "find_game_error" : "find_game_invalid_captcha";
                this.sendState();
                return;
            }
        }

        const tokenMap = new Map<Player, string>();

        const playerData = await getFindGamePlayerData(
            this.players.map((player) => {
                const joinToken = randomUUID();
                tokenMap.set(player, joinToken);
                return {
                    joinToken,
                    userId: player.userId,
                    ip: player.ip,
                } satisfies FindGamePrivateBody["playerData"][0];
            }),
        );

        const res = await findGame({
            mapName: mode.mapName,
            teamMode: mode.teamMode,
            autoFill: this.data.autoFill,
            region: region,
            version: data.version,
            playerData,
        });

        if ("error" in res) {
            const errMap: Partial<Record<FindGamePrivateError, TeamMenuErrorType>> = {
                full: "find_game_full",
                invalid_protocol: "find_game_invalid_protocol",
            };

            this.data.lastError = errMap[res.error] || "find_game_error";
            this.sendState();
            // 1 second cooldown on error
            this.findGameCooldown = Date.now() + 1000;
            return;
        }

        this.findGameCooldown = Date.now() + 5000;

        this.data.lastError = undefined;

        for (const player of this.players) {
            const token = tokenMap.get(player);
            // joined during the search, stays in the menu until the next one
            if (!token) continue;

            player.inGame = true;
            player.send("joinGame", {
                joinToken: token,
                urls: res.urls,
            });
        }

        this.sendState();
    }

    sendState() {
        const players = this.players.map((p) => p.data);
        // all players must be logged in to disable it
        this.data.captchaEnabled = settings.captchaEnabled && !this.players.every((p) => !!p.userId);
        for (const player of this.players) {
            player.send("state", {
                localPlayerId: player.playerId,
                room: this.data,
                players,
            });
        }
    }
}
