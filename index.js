import dayjs from "dayjs";
import dotenv from "dotenv";
import express from "express";
import cron from "node-cron";
import TelegramBot from "node-telegram-bot-api";
import { commandDescriptions } from "./src/config/command-descriptions.js";
import { registerBotRoutes } from "./src/routes/bot-routes.js";
import { checkSSLCertificates } from "./src/services/ssl-monitor.js";
import { checkWebsites } from "./src/services/website-monitor.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

registerBotRoutes(bot);

const commands = Object.entries(commandDescriptions).map(
	([command, description]) => ({
		command,
		description,
	}),
);

(async () => {
	await bot.setMyCommands(commands);
})();

const websiteMonitoringJob = cron.schedule(
	"*/5 * * * *",
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

app.get("/", (_req, res) => res.send("Bot is running"));
app.listen(port, () => {
	console.log(`Server listening on port ${port}`);

	setInterval(async () => {
		await fetch(`${process.env.BASE_URL}`)
			.then((_res) => console.log("Pinged /"))
			.catch((err) => console.error(err.message));
	}, 300000);
});
