import pool from "../config/db.js";

export async function saveUserDetails(id, userName) {
	const client = await pool.connect();
	try {
		const res = await client.query(
			"SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)",
			[id],
		);
		const userExists = res.rows[0].exists;

		if (!userExists) {
			await client.query("INSERT INTO users (id, user_name) VALUES ($1, $2)", [
				id,
				userName,
			]);
			console.log("User details saved successfully");
		} else {
			console.log("User already exists, no action taken");
		}
	} catch (error) {
		console.error("Error saving user details:", error);
	} finally {
		client.release();
	}
}

export async function updateUserEmailPreference(userId, preference) {
	const client = await pool.connect();
	try {
		await client.query("UPDATE users SET email_opt_in = $1 WHERE id = $2", [
			preference,
			userId,
		]);
		console.log("User email preference updated successfully");
	} catch (error) {
		console.error("Error updating email preference:", error);
	} finally {
		client.release();
	}
}
