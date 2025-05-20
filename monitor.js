import fetch from "node-fetch";
import pool from "./db.js";

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
					bot.sendMessage(
						monitor.chat_id,
						`⚠️ [${monitor.name}](${monitor.url}) is DOWN!`,
						{
							parse_mode: "Markdown",
							disable_web_page_preview: true,
						},
					);
				} else if (!isDown && monitor.status === "down") {
					await client.query("UPDATE monitors SET status=$1 WHERE id=$2", [
						"up",
						monitor.id,
					]);
					bot.sendMessage(
						monitor.chat_id,
						`✅ [${monitor.name}](${monitor.url}) is back UP!`,
						{
							parse_mode: "Markdown",
							disable_web_page_preview: true,
						},
					);
				}
			} catch (err) {
				if (monitor.status !== "down") {
					await client.query("UPDATE monitors SET status=$1 WHERE id=$2", [
						"down",
						monitor.id,
					]);
					bot.sendMessage(
						monitor.chat_id,
						`❌ [${monitor.name}](${monitor.url}) is not reachable!`,
						{
							parse_mode: "Markdown",
							disable_web_page_preview: true,
						},
					);
				}
			}
		}
	} finally {
		client.release();
	}
}

export async function addMonitor(chatId, url, name) {
	const client = await pool.connect();
	try {
		const res = await client.query(
			"SELECT * FROM monitors WHERE chat_id=$1 AND url=$2",
			[chatId, url],
		);
		if (res.rowCount > 0) return false;
		await client.query(
			"INSERT INTO monitors (chat_id, url, name, status) VALUES ($1, $2, $3, $4)",
			[chatId, url, name, "unknown"],
		);
		return true;
	} finally {
		client.release();
	}
}

export async function removeMonitor(chatId, url) {
	const client = await pool.connect();
	try {
		await client.query("DELETE FROM monitors WHERE chat_id=$1 AND url=$2", [
			chatId,
			url,
		]);
	} finally {
		client.release();
	}
}

export async function removeAllMonitors(chatId) {
	const client = await pool.connect();
	try {
		await client.query("DELETE FROM monitors WHERE chat_id=$1", [chatId]);
	} finally {
		client.release();
	}
}

export async function listMonitors(chatId) {
	const client = await pool.connect();
	try {
		const res = await client.query(
			"SELECT url, name FROM monitors WHERE chat_id = $1",
			[chatId],
		);
		return res.rows;
	} finally {
		client.release();
	}
}
