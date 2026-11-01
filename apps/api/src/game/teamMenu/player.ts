import type { ServerToClientTeamMsg, TeamMenuPlayer } from "@survev/shared/types/team.ts";
import { validateUserName } from "@survev/shared/utils/badWords.ts";
import { hashIp } from "../../moderation/bans.ts";
import type { Room } from "./room.ts";

/** the part of the socket the team menu uses */
export interface Socket {
    send(data: string): unknown;
    close(): void;
}

export class Player {
    room?: Room;

    name = "Player";

    inGame = false;

    get isLeader() {
        // first player is always leader
        return !!this.room && this.room.players[0] == this;
    }

    get playerId() {
        return this.room ? this.room.players.indexOf(this) : -1;
    }

    get data(): TeamMenuPlayer {
        return {
            name: this.name,
            inGame: this.inGame,
            isLeader: this.isLeader,
            playerId: this.playerId,
        };
    }

    lastMsgTime = Date.now();

    disconnectTimeout: ReturnType<typeof setTimeout>;

    encodedIp: string;

    constructor(
        public socket: Socket,
        public userId: string | null,
        public ip: string,
    ) {
        this.encodedIp = hashIp(ip);
        // disconnect if didn't join a room in 5 seconds
        this.disconnectTimeout = setTimeout(() => {
            if (!this.room) {
                this.socket.close();
            }
        }, 5000);
    }

    setName(name: string) {
        this.name = validateUserName(name).validName;
    }

    send<T extends ServerToClientTeamMsg["type"]>(
        type: T,
        data: (ServerToClientTeamMsg & { type: T })["data"],
    ) {
        this.socket.send(
            JSON.stringify({
                type,
                data,
            }),
        );
    }
}
