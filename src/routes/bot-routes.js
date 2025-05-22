import dayjs from "dayjs";
import {
	addMonitor,
	listMonitors,
	removeAllMonitors,
	removeMonitor,
	updateSSLInfo,
} from "../services/bot-service.js";
import { checkDomain } from "../services/ssl-checker.js";
import {
	saveUserDetails,
	updateUserEmailPreference,
} from "../services/user-service.js";
import { sendBotMessage } from "../utils/bot-utils.js";

export const registerBotRoutes = (bot) => {
	bot.onText(/\/start/, async (msg) => {
		const chatId = msg.chat.id;
		const userName = msg.from.username;
		const description =
			"Welcome to the Uptime Ninja Bot! 🤖.\n\n" +
			"This bot is designed to help you keep track of your website's uptime. " +
			"You can easily add URLs to monitor, check their status, and receive notifications if they go down.\n\n" +
			"Here are some commands to get you started:\n" +
			"/add - Add a new URL to monitor\n" +
			"/remove <domain> - Remove a URL from monitoring\n" +
			"/removeall - Clear all monitored URLs\n" +
			"/status - Get the current status of a URL\n" +
			"/list - View all monitored URLs\n" +
			"/alive - Verify if the bot is active\n" +
			"/checkssl - Check SSL certificate status for a domain";

		await saveUserDetails(chatId, userName);
		sendBotMessage(bot, chatId, description);
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

		await updateUserEmailPreference(userId, preference);

		sendBotMessage(
			bot,
			chatId,
			`Your email preference has been updated to: ${preference ? "Opt-in" : "Opt-out"}`,
		);
	});
};
