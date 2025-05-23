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
import { sendBotMessage } from "../utils/bot-utils.js";

export const registerBotRoutes = (bot) => {
	bot.onText(/\/start/, async (msg) => {
		const chatId = msg.chat.id;
		const userName = msg.from.username;
		const commandText = Object.entries(commandDescriptions)
			.map(([command, description]) => {
				return `/${command} - ${description}`;
			})
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
	});

	bot.onText(/\/alive/, (msg) => {
		sendBotMessage(bot, msg.chat.id, "🤖 I'm up and running!");
	});

	bot.onText(/\/add/, async (msg) => {
		const chatId = msg.chat.id;
		sendBotMessage(bot, chatId, "Please enter the monitor name:");

		bot.once("message", async (nameMsg) => {
			const monitorName = nameMsg.text.trim();
			sendBotMessage(bot, chatId, "Please enter the monitor URL:");

			bot.once("message", async (urlMsg) => {
				let monitorUrl = urlMsg.text.trim();
				if (!monitorUrl.startsWith("http")) {
					monitorUrl = `https://${monitorUrl}`;
				}
				const success = await addMonitor(chatId, monitorUrl, monitorName);
				sendBotMessage(
					bot,
					chatId,
					success
						? `✅ Now monitoring ${monitorUrl} with name ${monitorName}`
						: `⚠️ ${monitorUrl} is already being monitored.`,
				);
			});
		});
	});

	bot.onText(/\/remove (.+)/, async (msg, match) => {
		const chatId = msg.chat.id;
		const url = match[1];
		await removeMonitor(chatId, url);
		sendBotMessage(bot, chatId, `🗑️ Removed monitoring for ${url}`);
	});

	bot.onText(/\/removeall/, async (msg) => {
		const chatId = msg.chat.id;
		await removeAllMonitors(chatId);
		sendBotMessage(bot, chatId, "🗑️ Removed all monitored URLs.");
	});

	bot.onText(/\/status/, async (msg) => {
		const chatId = msg.chat.id;
		sendBotMessage(bot, chatId, "Please enter the monitor URL:");

		bot.once("message", async (url) => {
			const monitorUrl = url.text.trim();
			try {
				await fetch(monitorUrl);
				sendBotMessage(bot, msg.chat.id, `✅ ${monitorUrl} is up and running.`);
			} catch {
				sendBotMessage(
					bot,
					msg.chat.id,
					`❌ ${monitorUrl} is not reachable right now.`,
				);
			}
		});
	});

	bot.onText(/\/list/, async (msg) => {
		const chatId = msg.chat.id;
		const monitors = await listMonitors(chatId);

		if (monitors.length === 0) {
			sendBotMessage(bot, chatId, "You have no monitored URLs.");
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
	});

	bot.onText(/\/checkssl/, async (msg) => {
		const chatId = msg.chat.id;
		sendBotMessage(bot, chatId, "Please enter the monitor URL:");
		bot.once("message", async (url) => {
			const monitorUrl = url.text.trim();

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
				sendBotMessage(bot, chatId, `❌ Error: ${error.message}`);
			}
		});
	});

	bot.onText(/\/settings/, (msg) => {
		const chatId = msg.chat.id;
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
	});

	bot.on("callback_query", async (callbackQuery) => {
		const message = callbackQuery.message;
		const chatId = message.chat.id;
		const userId = callbackQuery.from.id;
		const preference = callbackQuery.data === "email_opt_in";

		if (preference) {
			const userEmail = await getUserEmail(chatId);
			// Email does not exist, ask for email
			if (!userEmail) {
				bot.sendMessage(chatId, "Please enter your email address:");
				bot.once("message", async (msg) => {
					const email = msg.text;
					if (validateEmail(email)) {
						await saveUserEmail(chatId, email, true);
						await updateUserEmailPreference(userId, preference);
						sendBotMessage(
							bot,
							chatId,
							`Your email preference has been updated to: ${preference ? "Opt-in" : "Opt-out"}`,
						);
					} else {
						sendBotMessage(
							bot,
							chatId,
							"Invalid email format. Please try again.",
						);
						return;
					}
				});
			} else {
				await updateUserEmailPreference(userId, preference);
				sendBotMessage(
					bot,
					chatId,
					`Your email preference has been updated to: ${preference ? "Opt-in" : "Opt-out"}`,
				);
			}
		} else {
			await updateUserEmailPreference(userId, preference);
			sendBotMessage(
				bot,
				chatId,
				`Your email preference has been updated to: ${preference ? "Opt-in" : "Opt-out"}`,
			);
		}

		// const userEmail = await getUserEmail(chatId);
		// if (!userEmail) {
		// 	// Email does not exist, ask for email
		// 	if (preference) {
		// 		bot.sendMessage(chatId, "Please enter your email address:");

		// 		// Listen for the next message to capture the email
		// 		bot.once("message", async (msg) => {
		// 			const email = msg.text;
		// 			if (validateEmail(email)) {
		// 				await saveUserEmail(chatId, email, true);
		// 			} else {
		// 				sendBotMessage(
		// 					bot,
		// 					chatId,
		// 					"Invalid email format. Please try again.",
		// 				);
		// 				return;
		// 			}
		// 		});
		// 	}
		// }

		// await updateUserEmailPreference(userId, preference);

		// sendBotMessage(
		// 	bot,
		// 	chatId,
		// 	`Your email preference has been updated to: ${preference ? "Opt-in" : "Opt-out"}`,
		// );
	});

	function validateEmail(email) {
		const re =
			/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/i;
		return re.test(String(email).toLowerCase());
	}
};
