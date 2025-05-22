import dotenv from "dotenv";
import cron from "node-cron";
import TelegramBot from "node-telegram-bot-api";
import { registerBotRoutes } from "./src/routes/bot-routes.js";
import { checkWebsites } from "./src/services/bot-service.js";

dotenv.config();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

registerBotRoutes(bot);

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

monitoringJob.start();

process.on("SIGTERM", () => {
	monitoringJob.stop();
	process.exit(0);
});

process.on("SIGINT", () => {
	monitoringJob.stop();
	process.exit(0);
});
