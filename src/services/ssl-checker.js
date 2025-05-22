import sslChecker from "ssl-checker";

export const checkDomain = async (hostname) => {
	const cleanedHostname = hostname.replace(/^https?:\/\//, "").split("/")[0];

	try {
		const result = await sslChecker(cleanedHostname);
		return {
			success: true,
			data: result,
		};
	} catch (error) {
		return {
			success: false,
			error: error.message,
		};
	}
};
