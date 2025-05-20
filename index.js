import dotenv from "dotenv";
import cron from "node-cron";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import {
	addMonitor,
	checkWebsites,
	listMonitors,
	removeAllMonitors,
	removeMonitor,
} from "./monitor.js";

dotenv.config();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

(async () => {
	await bot.setMyCommands([
		{ command: "add", description: "Add URL to monitor" },
		{ command: "remove", description: "Remove URL from monitoring" },
		{ command: "removeall", description: "Remove all monitored URLs" },
		{ command: "status", description: "Check status of URL" },
		{ command: "list", description: "List all monitored URLs" },
		{ command: "alive", description: "Check if bot is running" },
	]);
})();

bot.onText(/\/start/, (msg) => {
	const chatId = msg.chat.id;
	const description =
		"Welcome to the Uptime Ninja Bot! 🤖.\n\nThis bot is designed to help you keep track of your website's uptime. You can easily add URLs to monitor, check their status, and receive notifications if they go down.\n\nHere are some commands to get you started:\n/add - Add a new URL to monitor\n/remove - Remove a URL from monitoring\n/removeall - Clear all monitored URLs\n/status - Get the current status of a URL\n/list - View all monitored URLs\n/alive - Verify if the bot is active";
	bot.sendMessage(chatId, description);
});

bot.onText(/\/alive/, (msg) => {
	bot.sendMessage(msg.chat.id, "🤖 I'm up and running!");
});

bot.onText(/\/add/, async (msg) => {
	const chatId = msg.chat.id;

	// Ask for monitor name
	bot.sendMessage(chatId, "Please enter the monitor name:");

	bot.once("message", async (nameMsg) => {
		const monitorName = nameMsg.text.trim();

		// Ask for monitor URL
		bot.sendMessage(chatId, "Please enter the monitor URL:");

		bot.once("message", async (urlMsg) => {
			const monitorUrl = urlMsg.text.trim();

			// Save to database
			const success = await addMonitor(chatId, monitorUrl, monitorName);
			bot.sendMessage(
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
	bot.sendMessage(chatId, `🗑️ Removed monitoring for ${url}`);
});

bot.onText(/\/removeall/, async (msg) => {
	const chatId = msg.chat.id;
	await removeAllMonitors(chatId);
	bot.sendMessage(chatId, "🗑️ Removed all monitored URLs.");
});

bot.onText(/\/status (.+)/, async (msg, match) => {
	const url = match[1];
	try {
		await fetch(url);
		bot.sendMessage(msg.chat.id, `✅ ${url} is up and running.`);
	} catch {
		bot.sendMessage(msg.chat.id, `❌ ${url} is not reachable right now.`);
	}
});

bot.onText(/\/list/, async (msg) => {
	const chatId = msg.chat.id;
	const monitors = await listMonitors(chatId);

	if (monitors.length === 0) {
		bot.sendMessage(chatId, "You have no monitored URLs.");
		return;
	}

	let response = "Here are your monitored URLs:\n\n";
	monitors.forEach((monitor, idx) => {
		response += `${idx + 1}. [${monitor.name}](${monitor.url})\n`;
	});

	bot.sendMessage(chatId, response, {
		parse_mode: "Markdown",
		disable_web_page_preview: true,
	});
});

const monitoringJob = cron.schedule(
	"*/10 * * * *",
	async () => {
		try {
			await checkWebsites(bot);
			console.log(
				`[${new Date().toISOString()}] Monitoring check completed successfully`,
			);
		} catch (error) {
			console.error(
				`[${new Date().toISOString()}] Error in monitoring check:`,
				error,
			);
		}
	},
	{
		scheduled: true,
		timezone: "UTC",
	},
);

// Ensure the cron job is running
monitoringJob.start();

// Handle process termination gracefully
process.on("SIGTERM", () => {
	monitoringJob.stop();
	process.exit(0);
});

process.on("SIGINT", () => {
	monitoringJob.stop();
	process.exit(0);
});
