import {
	addMonitor,
	listMonitors,
	removeAllMonitors,
	removeMonitor,
} from "../services/bot-service.js";
import { sendBotMessage } from "../utils/bot-utils.js";

export const registerBotRoutes = (bot) => {
	bot.onText(/\/start/, (msg) => {
		const chatId = msg.chat.id;
		const description =
			"Welcome to the Uptime Ninja Bot! 🤖.\n\nThis bot is designed to help you keep track of your website's uptime. You can easily add URLs to monitor, check their status, and receive notifications if they go down.\n\nHere are some commands to get you started:\n/add - Add a new URL to monitor\n/remove - Remove a URL from monitoring\n/removeall - Clear all monitored URLs\n/status - Get the current status of a URL\n/list - View all monitored URLs\n/alive - Verify if the bot is active";
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
				const monitorUrl = urlMsg.text.trim();
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

	bot.onText(/\/status (.+)/, async (msg, match) => {
		const url = match[1];
		try {
			await fetch(url);
			sendBotMessage(bot, msg.chat.id, `✅ ${url} is up and running.`);
		} catch {
			sendBotMessage(bot, msg.chat.id, `❌ ${url} is not reachable right now.`);
		}
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
};
