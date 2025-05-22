import dayjs from "dayjs";
import dotenv from "dotenv";
import cron from "node-cron";
import TelegramBot from "node-telegram-bot-api";
import { registerBotRoutes } from "./src/routes/bot-routes.js";
import { checkSSLCertificates } from "./src/services/ssl-monitor.js";
import { checkWebsites } from "./src/services/website-monitor.js";

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
		{
			command: "checkssl",
			description: "Check SSL certificate status for a domain",
		},
		{ command: "alive", description: "Check if bot is running" },
	]);
})();

const websiteMonitoringJob = cron.schedule(
	"*/1 * * * *",
	async () => {
		try {
			await checkWebsites(bot);
			console.log(
				`[${dayjs().format()}] Monitoring check completed successfully`,
			);
		} catch (error) {
			console.error(`[${dayjs().format()}] Error in monitoring check:`, error);
		}
	},
	{
		scheduled: true,
		timezone: "UTC",
	},
);

const sslMonitoringJob = cron.schedule(
	"0 0 * * *",
	async () => {
		try {
			await checkSSLCertificates(bot);
			console.log(
				`[${dayjs().format()}] SSL certificate check completed successfully`,
			);
		} catch (error) {
			console.error(
				`[${dayjs().format()}] Error in SSL certificate check:`,
				error,
			);
		}
	},
	{
		scheduled: true,
		timezone: "UTC",
	},
);

websiteMonitoringJob.start();
sslMonitoringJob.start();

process.on("SIGTERM", () => {
	websiteMonitoringJob.stop();
	sslMonitoringJob.stop();
	process.exit(0);
});

process.on("SIGINT", () => {
	websiteMonitoringJob.stop();
	sslMonitoringJob.stop();
	process.exit(0);
});
