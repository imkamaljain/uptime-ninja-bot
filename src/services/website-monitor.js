import dayjs from "dayjs";
import fetch from "node-fetch";
import pool from "../config/db.js";
import { generateWebsiteMonitoringTemplate } from "../templates/website-monitoring-template.js";
import { sendBotMessage } from "../utils/bot-utils.js";
import { sendEmail } from "../utils/email-utils.js";

export async function checkWebsites(bot) {
	const client = await pool.connect();
	try {
		const res = await client.query("SELECT * FROM monitors");
		for (const monitor of res.rows) {
			try {
				const response = await fetch(monitor.url, { timeout: 5000 });
				const isDown = !(response.status >= 200 && response.status < 400);

				if (isDown && monitor.status !== "down") {
					await client.query("UPDATE monitors SET status=$1 WHERE id=$2", [
						"down",
						monitor.id,
					]);
					sendBotMessage(
						bot,
						monitor.chat_id,
						`⚠️ [${monitor.name}](${monitor.url}) is DOWN!`,
					);
					sendEmail(
						"kamaljain@medpiper.com",
						`Monitor is DOWN: ${monitor.name}`,
						generateWebsiteMonitoringTemplate(
							monitor.name,
							monitor.url,
							"DOWN",
						),
					);
				} else if (!isDown && monitor.status === "down") {
					await client.query("UPDATE monitors SET status=$1 WHERE id=$2", [
						"up",
						monitor.id,
					]);
					sendBotMessage(
						bot,
						monitor.chat_id,
						`✅ [${monitor.name}](${monitor.url}) is back UP!`,
					);
					sendEmail(
						"kamaljain@medpiper.com",
						`Monitor is UP: ${monitor.name}`,
						generateWebsiteMonitoringTemplate(monitor.name, monitor.url, "UP"),
					);
				}
			} catch (err) {
				if (monitor.status !== "down") {
					await client.query("UPDATE monitors SET status=$1 WHERE id=$2", [
						"down",
						monitor.id,
					]);
					sendBotMessage(
						bot,
						monitor.chat_id,
						`❌ [${monitor.name}](${monitor.url}) is not reachable!`,
					);
					sendEmail(
						"kamaljain@medpiper.com",
						`Monitor is DOWN: ${monitor.name}`,
						generateWebsiteMonitoringTemplate(
							monitor.name,
							monitor.url,
							"DOWN",
						),
					);
				}
			}
		}
	} finally {
		client.release();
	}
}
