import type { ModRouterSpectateGameRes } from "@survev/contracts";
import { GameConfig } from "@survev/shared/gameConfig.ts";
import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { env } from "../env.ts";
import { apiClient, apiMessage, botLogger, Command, hasBotPermission } from "../utils.ts";
import { sendNoPermissionMessage } from "./helpers.ts";

export const spectateCommandHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.SpectatePlayer)
        .setDescription("Search a player to spectate")
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("The slug of the player to spectate")
                .setChoices([
                    { name: "Use slug", value: "user_id" },
                    { name: "Use in-game name", value: "player_name" },
                ])
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("value")
                .setDescription("The name or account slug of the player to spectate")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!hasBotPermission(interaction)) {
            await sendNoPermissionMessage(interaction);
            return;
        }

        const type = interaction.options.getString("type") as "user_id" | "player_name";
        const value = interaction.options.getString("value")!;

        await interaction.deferReply();

        // Stupid thing that updates the message as it gets more responses from servers :)
        const responses: ModRouterSpectateGameRes[] = [];

        const editReply = async (done: boolean) => {
            const playerData: Array<{ region: string; data: string; url: string }> = responses.map(data => {
                return data.players.map((gameData) => {
                    const joinData = gameData.data;

                    const url = new URL(env.PUBLIC_URL);
                    // shortened because long URLs make the discord message run out of characters faster...
                    url.searchParams.set("u", btoa(joinData.urls.join(",")));
                    url.searchParams.set("jt", joinData.joinToken);

                    return {
                        region: data.region,
                        data: `${gameData.gameId.slice(0, 6)} - ${
                            GameConfig.TeamModeToString[gameData.teamMode].padEnd(5)
                        } - ${gameData.mapName}`,
                        url: `[Join Link](${url.toString()})`,
                    };
                });
            }).flat();

            const embed = new EmbedBuilder().setColor(done ? 0x00ff00 : 0xffff00);

            let title = "Searching...";

            if (playerData.length) {
                const columnWidths = playerData.reduce((a, b) => {
                    for (const [key, value] of Object.entries(b)) {
                        a[key] = Math.max(a[key] ?? 0, value.length);
                    }
                    return a;
                }, { region: 8, data: 25 } as Record<string, number>);

                let playerCount = 0;

                let text = "**";
                const addRow = (value: { region: string; data: string; url: string }) => {
                    let newRow = "";
                    newRow += `\`${value.region.padEnd(columnWidths.region)}`;
                    newRow += `| ${value.data.padEnd(columnWidths.data)} |\``;
                    newRow += ` ${value.url}\n`;

                    // i hate discord limits
                    if (text.length + newRow.length < 4096) {
                        text += newRow;
                        playerCount++;
                    }
                };
                addRow({ region: "Region", data: "Game info", url: "URL" });
                text += "**";
                for (const data of playerData) {
                    addRow(data);
                }

                embed.setDescription(text);
                embed.setFooter({
                    text: "NOTE: Join links expire after 1 minute, if the target player died or if the game ended.",
                });
                if (done) {
                    title = `Found ${playerCount} player${playerCount > 1 ? "s" : ""} with ${
                        type === "player_name" ? "name" : "slug"
                    } \`${value}\`.`;
                }
            } else if (done) {
                title = "No player found matching the filter";
            }
            embed.setTitle(title);

            await interaction.editReply({
                embeds: [embed],
            });
        };

        const res = await apiClient.moderation.spectate_player.post({
            filter: {
                type,
                value,
            },
        });

        // for API errors like user not found
        if (res.error) {
            await interaction.editReply({
                content: apiMessage(res),
            });
            return;
        }

        // eden yields the response as it streams in, each chunk is one or more json lines.
        // a response that arrived in one piece (content-length, no chunking) is plain text instead,
        // and a chunk that happens to be a single complete json value comes already parsed
        const data: unknown = res.data;
        const chunks = typeof data === "string" ? [data] : res.data;
        for await (const chunk of chunks) {
            const read = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
            const values = read.split("\n");

            for (const value of values) {
                if (!value) continue;

                try {
                    const jsonRes = JSON.parse(value) as ModRouterSpectateGameRes;
                    responses.push(jsonRes);
                    await editReply(jsonRes.done);
                } catch (e) {
                    botLogger.error("bot.spectate_response_parse_failed", { err: e });
                }
            }
        }
        await editReply(true);
    },
};
