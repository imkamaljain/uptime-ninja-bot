import dayjs from "dayjs";
import { commandDescriptions } from "../config/command-descriptions.js";
import {
	addMonitor,
	listMonitors,
	removeAllMonitors,
	removeMonitor,
	updateSSLInfo,
} from "../services/bot-service.js";
import { checkDomain } from "../services/ssl-checker.js";
import {
	getUserEmail,
	saveUserDetails,
	saveUserEmail,
	updateUserEmailPreference,
} from "../services/user-service.js";
import { sendBotMessage, sendTypingAction } from "../utils/bot-utils.js";

// In-memory state store to track what input the bot is expecting
const userStates = new Map(); // Map<chatId, { state: string, data: any, timeoutId: NodeJS.Timeout }>
const STATE_TIMEOUT_MS = 60000; // 60 seconds timeout for user input

export const registerBotRoutes = (bot) => {
	// Helper function to check if message is a command
	const isCommand = (text) =>
		text && typeof text === "string" && text.startsWith("/");

	// Helper function to validate URLs
	const validateUrl = (url) => {
		try {
			new URL(url.startsWith("http") ? url : `https://${url}`);
			return true;
		} catch {
			return false;
		}
	};

	// Helper function to validate monitor name (e.g., non-empty, reasonable length)
	const validateMonitorName = (name) => {
		return (
			name && typeof name === "string" && name.length > 0 && name.length <= 100
		);
	};

	// Clear state for a user
	const clearState = (chatId) => {
		const state = userStates.get(chatId);
		if (state?.timeoutId) {
			clearTimeout(state.timeoutId);
		}
		userStates.delete(chatId);
	};

	// Set state for a user with timeout
	const setState = (chatId, state, data = {}) => {
		clearState(chatId); // Clear any existing state
		const timeoutId = setTimeout(() => {
			sendBotMessage(
				bot,
				chatId,
				"⏰ Timed out waiting for your response. Please try again.",
			);
			clearState(chatId);
		}, STATE_TIMEOUT_MS);
		userStates.set(chatId, { state, data, timeoutId });
	};

	// Get state for a user
	const getState = (chatId) => userStates.get(chatId) || {};

	bot.onText(/\/start/, async (msg) => {
		const chatId = msg.chat.id;
		const userName = msg.from.username || "Unknown";
		try {
			const commandText = Object.entries(commandDescriptions)
				.map(([command, description]) => `/${command} - ${description}`)
				.join("\n");
			const description = `Welcome to the Uptime Ninja Bot! 🤖.\n\nThis bot is designed to help you keep track of your website's uptime. You can easily add URLs to monitor, check their status, and receive notifications if they go down.\n\nHere are some commands to get you started:\n${commandText}`;

			await saveUserDetails(chatId, userName);
			sendBotMessage(bot, chatId, description);

			setTimeout(() => {
				bot.sendMessage(
					chatId,
					"Would you like to receive email notifications?",
					{
						reply_markup: {
							inline_keyboard: [
								[
									{ text: "Opt-in", callback_data: "email_opt_in" },
									{ text: "Opt-out", callback_data: "email_opt_out" },
								],
							],
						},
					},
				);
			}, 1000);
		} catch (error) {
			console.error(`Error in /start for chatId ${chatId}:`, error);
			sendBotMessage(
				bot,
				chatId,
				"❌ An error occurred while starting the bot. Please try again later.",
			);
		}
	});

	bot.onText(/\/alive/, (msg) => {
		const chatId = msg.chat.id;
		if (getState(chatId).state) {
			sendBotMessage(
				bot,
				chatId,
				"Previous action canceled due to new command.",
			);
		}
		sendBotMessage(bot, chatId, "🤖 I'm up and running!");
		clearState(chatId);
	});

	bot.onText(/\/add/, async (msg) => {
		const chatId = msg.chat.id;
		try {
			sendBotMessage(bot, chatId, "Please enter the monitor name:");
			sendTypingAction(bot, chatId);
			setState(chatId, "AWAITING_MONITOR_NAME");
		} catch (error) {
			console.error(`Error in /add for chatId ${chatId}:`, error);
			sendBotMessage(bot, chatId, "❌ An error occurred. Please try again.");
			clearState(chatId);
		}
	});

	bot.onText(/\/remove (.+)/, async (msg, match) => {
		const chatId = msg.chat.id;
		const url = match[1];
		try {
			if (getState(chatId).state) {
				sendBotMessage(
					bot,
					chatId,
					"Previous action canceled due to new command.",
				);
			}
			sendTypingAction(bot, chatId);
			if (!validateUrl(url)) {
				sendBotMessage(
					bot,
					chatId,
					"❌ Invalid URL format. Please provide a valid URL.",
				);
				return;
			}
			await removeMonitor(chatId, url);
			sendBotMessage(bot, chatId, `🗑️ Removed monitoring for ${url}`);
			clearState(chatId);
		} catch (error) {
			console.error(`Error in /remove for chatId ${chatId}:`, error);
			sendBotMessage(bot, chatId, `❌ Error removing ${url}: ${error.message}`);
			clearState(chatId);
		}
	});

	bot.onText(/\/removeall/, async (msg) => {
		const chatId = msg.chat.id;
		try {
			if (getState(chatId).state) {
				sendBotMessage(
					bot,
					chatId,
					"Previous action canceled due to new command.",
				);
			}
			sendTypingAction(bot, chatId);
			await removeAllMonitors(chatId);
			sendBotMessage(bot, chatId, "🗑️ Removed all monitored URLs.");
			clearState(chatId);
		} catch (error) {
			console.error(`Error in /removeall for chatId ${chatId}:`, error);
			sendBotMessage(
				bot,
				chatId,
				"❌ Error removing all monitors: ${error.message}",
			);
			clearState(chatId);
		}
	});

	bot.onText(/\/status/, async (msg) => {
		const chatId = msg.chat.id;
		try {
			if (getState(chatId).state) {
				sendBotMessage(
					bot,
					chatId,
					"Previous action canceled due to new command.",
				);
			}
			sendBotMessage(bot, chatId, "Please enter the monitor URL:");
			sendTypingAction(bot, chatId);
			setState(chatId, "AWAITING_STATUS_URL");
		} catch (error) {
			console.error(`Error in /status for chatId ${chatId}:`, error);
			sendBotMessage(bot, chatId, "❌ An error occurred. Please try again.");
			clearState(chatId);
		}
	});

	bot.onText(/\/list/, async (msg) => {
		const chatId = msg.chat.id;
		try {
			if (getState(chatId).state) {
				sendBotMessage(
					bot,
					chatId,
					"Previous action canceled due to new command.",
				);
			}
			sendTypingAction(bot, chatId);
			const monitors = await listMonitors(chatId);

			if (monitors.length === 0) {
				sendBotMessage(bot, chatId, "You have no monitored URLs.");
				clearState(chatId);
				return;
			}

			let response = "Here are your monitored URLs:\n\n";
			monitors.forEach((monitor, idx) => {
				response += `${idx + 1}. [${monitor.name}](${monitor.url})\n`;
			});

			sendBotMessage(bot, chatId, response, {
				parse_mode: "Markdown",
				disable_web_page_preview: true,
			});
			clearState(chatId);
		} catch (error) {
			console.error(`Error in /list for chatId ${chatId}:`, error);
			sendBotMessage(
				bot,
				chatId,
				"❌ Error listing monitors: ${error.message}",
			);
			clearState(chatId);
		}
	});

	bot.onText(/\/checkssl/, async (msg) => {
		const chatId = msg.chat.id;
		try {
			if (getState(chatId).state) {
				sendBotMessage(
					bot,
					chatId,
					"Previous action canceled due to new command.",
				);
			}
			sendTypingAction(bot, chatId);
			sendBotMessage(bot, chatId, "Please enter the monitor URL:");
			setState(chatId, "AWAITING_SSL_URL");
		} catch (error) {
			console.error(`Error in /checkssl for chatId ${chatId}:`, error);
			sendBotMessage(bot, chatId, "❌ An error occurred. Please try again.");
			clearState(chatId);
		}
	});

	bot.onText(/\/settings/, (msg) => {
		const chatId = msg.chat.id;
		try {
			if (getState(chatId).state) {
				sendBotMessage(
					bot,
					chatId,
					"Previous action canceled due to new command.",
				);
			}
			sendBotMessage(bot, chatId, "Please choose your email preference:", {
				reply_markup: {
					inline_keyboard: [
						[
							{ text: "Opt-in", callback_data: "email_opt_in" },
							{ text: "Opt-out", callback_data: "email_opt_out" },
						],
					],
				},
			});
			clearState(chatId);
		} catch (error) {
			console.error(`Error in /settings for chatId ${chatId}:`, error);
			sendBotMessage(bot, chatId, "❌ An error occurred. Please try again.");
			clearState(chatId);
		}
	});

	// Handle all messages to process state-based input
	bot.on("message", async (msg) => {
		const chatId = msg.chat.id;
		const text = msg.text ? msg.text.trim() : "";

		// Skip if message is a command
		if (isCommand(text)) {
			if (getState(chatId).state) {
				sendBotMessage(
					bot,
					chatId,
					"Previous action canceled due to new command.",
				);
				clearState(chatId);
			}
			return;
		}

		const state = getState(chatId);

		try {
			if (state.state === "AWAITING_MONITOR_NAME") {
				if (!validateMonitorName(text)) {
					sendBotMessage(
						bot,
						chatId,
						"❌ Invalid monitor name. Please provide a non-empty name (max 100 characters).",
					);
					return;
				}
				sendBotMessage(bot, chatId, "Please enter the monitor URL:");
				sendTypingAction(bot, chatId);
				setState(chatId, "AWAITING_MONITOR_URL", { monitorName: text });
			} else if (state.state === "AWAITING_MONITOR_URL") {
				let monitorUrl = text;
				if (!monitorUrl.startsWith("http")) {
					monitorUrl = `https://${monitorUrl}`;
				}
				if (!validateUrl(monitorUrl)) {
					sendBotMessage(
						bot,
						chatId,
						"❌ Invalid URL format. Please provide a valid URL.",
					);
					return;
				}
				const success = await addMonitor(
					chatId,
					monitorUrl,
					state.data.monitorName,
				);
				sendBotMessage(
					bot,
					chatId,
					success
						? `✅ Now monitoring ${monitorUrl} with name ${state.data.monitorName}`
						: `⚠️ ${monitorUrl} is already being monitored.`,
				);
				clearState(chatId);
			} else if (state.state === "AWAITING_STATUS_URL") {
				let monitorUrl = text;
				if (!monitorUrl.startsWith("http")) {
					monitorUrl = `https://${monitorUrl}`;
				}
				if (!validateUrl(monitorUrl)) {
					sendBotMessage(
						bot,
						chatId,
						"❌ Invalid URL format. Please provide a valid URL.",
					);
					return;
				}
				try {
					await fetch(monitorUrl);
					sendBotMessage(bot, chatId, `✅ ${monitorUrl} is up and running.`);
				} catch (error) {
					sendBotMessage(
						bot,
						chatId,
						`❌ ${monitorUrl} is not reachable right now: ${error.message}`,
					);
				}
				clearState(chatId);
			} else if (state.state === "AWAITING_SSL_URL") {
				let monitorUrl = text;
				if (!monitorUrl.startsWith("http")) {
					monitorUrl = `https://${monitorUrl}`;
				}
				if (!validateUrl(monitorUrl)) {
					sendBotMessage(
						bot,
						chatId,
						"❌ Invalid URL format. Please provide a valid URL.",
					);
					return;
				}
				try {
					const result = await checkDomain(monitorUrl);
					if (result.success) {
						const data = result.data;
						const message =
							`SSL Check Results for ${monitorUrl}:\n` +
							`✅ Valid: ${data.valid}\n` +
							`📅 Valid From: ${dayjs(data.validFrom).format("MMMM D, YYYY")}\n` +
							`📅 Valid Until: ${dayjs(data.validTo).format("MMMM D, YYYY")}\n` +
							`⏳ Expiry in: ${data.daysRemaining} days\n`;

						await updateSSLInfo(chatId, monitorUrl, data);
						sendBotMessage(bot, chatId, message);
					} else {
						sendBotMessage(
							bot,
							chatId,
							`❌ Error checking SSL for ${monitorUrl}: ${result.error}`,
						);
					}
				} catch (error) {
					sendBotMessage(
						bot,
						chatId,
						`❌ Error checking SSL for ${monitorUrl}: ${error.message}`,
					);
				}
				clearState(chatId);
			} else if (state.state === "AWAITING_EMAIL") {
				if (!validateEmail(text)) {
					sendBotMessage(
						bot,
						chatId,
						"❌ Invalid email format. Please provide a valid email address.",
					);
					return;
				}
				await saveUserEmail(chatId, text, true);
				await updateUserEmailPreference(chatId, true);
				sendBotMessage(
					bot,
					chatId,
					"Your email preference has been updated to: Opt-in",
				);
				clearState(chatId);
			}
		} catch (error) {
			console.error(`Error processing message for chatId ${chatId}:`, error);
			sendBotMessage(
				bot,
				chatId,
				"❌ An unexpected error occurred. Please try again.",
			);
			clearState(chatId);
		}
	});

	bot.on("callback_query", async (callbackQuery) => {
		const message = callbackQuery.message;
		const chatId = message.chat.id;
		const userId = callbackQuery.from.id;
		const preference = callbackQuery.data === "email_opt_in";

		try {
			if (getState(chatId).state) {
				sendBotMessage(
					bot,
					chatId,
					"Previous action canceled due to new command.",
				);
			}
			if (preference) {
				const userEmail = await getUserEmail(chatId);
				if (!userEmail) {
					sendBotMessage(bot, chatId, "Please enter your email address:");
					setState(chatId, "AWAITING_EMAIL");
				} else {
					await updateUserEmailPreference(userId, preference);
					sendBotMessage(
						bot,
						chatId,
						`Your email preference has been updated to: ${preference ? "Opt-in" : "Opt-out"}`,
					);
					clearState(chatId);
				}
			} else {
				await updateUserEmailPreference(userId, preference);
				sendBotMessage(
					bot,
					chatId,
					`Your email preference has been updated to: ${preference ? "Opt-in" : "Opt-out"}`,
				);
				clearState(chatId);
			}
		} catch (error) {
			console.error(`Error in callback_query for chatId ${chatId}:`, error);
			sendBotMessage(
				bot,
				chatId,
				"❌ An error occurred while updating email preference. Please try again.",
			);
			clearState(chatId);
		}
	});

	function validateEmail(email) {
		const re =
			/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/i;
		return re.test(String(email).toLowerCase());
	}
};
