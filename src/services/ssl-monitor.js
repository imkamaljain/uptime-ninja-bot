import dayjs from "dayjs";
import pool from "../config/db.js";
import { sendBotMessage } from "../utils/bot-utils.js";

export async function checkSSLCertificates(bot) {
	const client = await pool.connect();
	try {
		// Query only records where SSL is expiring within next 2 days
		const res = await client.query(
			`SELECT chat_id, name, url, ssl_valid_to FROM monitors 
            WHERE ssl_valid_to IS NOT NULL 
            AND ssl_valid_to <= NOW() + INTERVAL '2 days'
            AND ssl_valid_to >= NOW()`,
		);

		for (const monitor of res.rows) {
			const daysRemaining = dayjs(monitor.ssl_valid_to).diff(dayjs(), "day");

			sendBotMessage(
				bot,
				monitor.chat_id,
				`⚠️ SSL Certificate Expiry Alert for [${monitor.name}](${monitor.url})\n` +
					`Certificate will expire in ${daysRemaining} days on ${dayjs(monitor.ssl_valid_to).format("MMMM D, YYYY")}`,
			);
		}
	} finally {
		client.release();
	}
}
