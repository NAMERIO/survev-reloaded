import type { Treaty } from "@elysia/eden";
import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { createDiscordDropdownUI } from "../components.ts";
import { apiClient, apiMessage, botLogger, Command, hasBotPermission } from "../utils.ts";
import { sendNoPermissionMessage } from "./helpers.ts";

export type SelectedPlayer = Treaty.Data<typeof apiClient.moderation.get_player_ip.post>[number];

export const BUTTON_PREFIXES = {
    BAN_FOR_CHEATING: `search_player_ban_for_cheating_`,
    BAN_FOR_BAD_NAME: `search_player_ban_for_name_`,
} as const;

export const searchPlayersHandler = {
    command: new SlashCommandBuilder()
        .setName(Command.SearchPlayer)
        .setDescription("Search and ban a player by name")
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("The name of the player to search for")
                .setRequired(true)
        )
        .addBooleanOption((option) =>
            option
                .setName("use_account_slug")
                .setDescription(
                    "If should search for account slugs instead of in-game names (defaults to false)",
                )
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("game_id")
                .setDescription("Specify a specific game to search for")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const searchName = interaction.options.getString("name")!;
        const useSlug = interaction.options.getBoolean("use_account_slug") || false;
        const gameId = interaction.options.getString("game_id") || undefined;

        await interaction.deferReply();

        if (!hasBotPermission(interaction)) {
            await sendNoPermissionMessage(interaction);
            return;
        }

        try {
            const res = await apiClient.moderation.get_player_ip.post({
                name: searchName!,
                use_account_slug: useSlug,
                game_id: gameId,
            });

            // no player found (or any other error), return message formatted by the api
            if (res.error) {
                await interaction.editReply({
                    content: apiMessage(res),
                });
                return;
            }

            const matchingPlayers = res.data;

            await createDiscordDropdownUI(interaction, matchingPlayers, searchName);
        } catch (error) {
            botLogger.error("bot.search_player_failed", { err: error });
            await interaction.editReply({
                content: "An error occurred while searching for players.",
            });
        }
    },
};
