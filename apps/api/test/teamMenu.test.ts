import { beforeEach, describe, expect, mock, test } from "bun:test";

const findGame = mock(async () => ({ urls: ["ws://game"] }) as object);
const getFindGamePlayerData = mock(async (players: unknown[]) => players);
const regions = { findGame, getFindGamePlayerData, isRegion: () => true, regionIds: () => ["local"] };
mock.module("../src/game/regions.ts", () => regions);

const { settings } = await import("../src/admin/settings.ts");
const { Player } = await import("../src/game/teamMenu/player.ts");
const { TeamMenu } = await import("../src/game/teamMenu/teamMenu.ts");

type Msg = { type: string; data: any };

function connect(teamMenu: InstanceType<typeof TeamMenu>) {
    const msgs: Msg[] = [];
    const socket = {
        closed: false,
        send: (m: string) => msgs.push(JSON.parse(m)),
        close() {
            this.closed = true;
        },
    };
    const player = teamMenu.addPlayer(socket, "user", "1.2.3.4");
    clearTimeout(player.disconnectTimeout);
    return { player, msgs, socket, last: (type: string) => msgs.findLast((m) => m.type === type) };
}

const roomData = { roomUrl: "", region: "local", gameModeIdx: 1, autoFill: true, findingGame: false, lastError: "" };
const playGame = { type: "playGame", data: { version: 1, region: "local", zones: [] } };

function createRoom(teamMenu: InstanceType<typeof TeamMenu>) {
    const leader = connect(teamMenu);
    teamMenu.onMsg(leader.player, { type: "create", data: { roomData, playerData: { name: "leader" } } });
    return { leader, room: leader.player.room! };
}

describe("team menu", () => {
    let teamMenu: InstanceType<typeof TeamMenu>;
    beforeEach(() => {
        teamMenu = new TeamMenu();
        settings.modes.forEach((mode) => (mode.enabled = true));
        findGame.mockReset();
        findGame.mockImplementation(async () => ({ urls: ["ws://game"] }));
        getFindGamePlayerData.mockReset();
        getFindGamePlayerData.mockImplementation(async (players) => players);
    });

    test("a player who joins during the search stays out of the game and can start the next one", async () => {
        const { leader, room } = createRoom(teamMenu);
        let finish!: (res: object) => void;
        findGame.mockImplementation(() => new Promise((resolve) => (finish = resolve)));

        const search = room.findGame(playGame.data);
        await Bun.sleep(0);
        const late = connect(teamMenu);
        room.addPlayer(late.player);
        finish({ urls: ["ws://game"] });
        await search;

        expect(leader.last("joinGame")).toBeDefined();
        expect(late.last("joinGame")).toBeUndefined();
        expect(late.player.inGame).toBe(false);
    });

    test("a failed database query reaches the room as an error", async () => {
        const { leader, room } = createRoom(teamMenu);
        getFindGamePlayerData.mockImplementation(async () => {
            throw new Error("db down");
        });

        teamMenu.onMsg(leader.player, playGame);
        await Bun.sleep(0);

        expect(room.data.lastError).toBe("find_game_error");
        expect(leader.last("state")?.data.room.lastError).toBe("find_game_error");
    });

    test("a disabled mode reports an error and doesn't search", async () => {
        const { leader, room } = createRoom(teamMenu);
        settings.modes[room.data.gameModeIdx].enabled = false;

        await room.findGame(playGame.data);

        expect(findGame).not.toHaveBeenCalled();
        expect(leader.last("state")?.data.room.lastError).toBe("find_game_error");
    });

    test("setRoomProps sees modes disabled after the room opened, and survives none being left", () => {
        const { room } = createRoom(teamMenu);
        settings.modes[1].enabled = false;
        room.setProps({ ...roomData, gameModeIdx: 1 });
        expect(room.data.gameModeIdx).not.toBe(1);
        expect(room.data.enabledGameModeIdxs).not.toContain(1);

        settings.modes.forEach((mode) => (mode.enabled = false));
        expect(() => room.setProps(roomData)).not.toThrow();
        expect(room.data.enabledGameModeIdxs).toEqual([]);
    });

    test("the sweep kicks every silent player in one pass", () => {
        const { leader, room } = createRoom(teamMenu);
        const second = connect(teamMenu);
        room.addPlayer(second.player);
        for (const player of [leader.player, second.player]) player.lastMsgTime = 0;

        teamMenu.sweep();

        expect(room.players).toEqual([]);
        expect(teamMenu.rooms.size).toBe(0);
        expect(second.last("error")?.data.type).toBe("lost_conn");
    });

    test("a player without a room who sends anything else is closed", () => {
        const { player, socket } = connect(teamMenu);
        teamMenu.onMsg(player, { type: "keepAlive", data: {} });
        expect(socket.closed).toBe(true);
        expect(player).toBeInstanceOf(Player);
    });
});
