import pool from "../config/db.js";
import { checkDomain } from "../services/ssl-checker.js";

export async function addMonitor(chatId, url, name) {
	const client = await pool.connect();
	try {
		const res = await client.query(
			"SELECT * FROM monitors WHERE chat_id=$1 AND url=$2",
			[chatId, url],
		);
		if (res.rowCount > 0) return false;

		const sslCheck = await checkDomain(url);
		const sslData = sslCheck.success ? sslCheck.data : {};

		await client.query(
			"INSERT INTO monitors (chat_id, name, url, status, ssl_valid_from, ssl_valid_to) VALUES ($1, $2, $3, $4, $5, $6)",
			[
				chatId,
				name,
				url,
				"unknown",
				sslData.validFrom || null,
				sslData.validTo || null,
			],
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

export const updateSSLInfo = async (chatId, url, sslData) => {
	const client = await pool.connect();
	try {
		const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
		await client.query(
			"UPDATE monitors SET ssl_valid_from=$1, ssl_valid_to=$2 WHERE chat_id=$3 AND url=$4",
			[sslData.validFrom, sslData.validTo, chatId, formattedUrl],
		);
		return true;
	} catch (error) {
		console.error("Error updating SSL info:", error);
		return false;
	} finally {
		client.release();
	}
};
