export const sendBotMessage = (bot, chatId, message) => {
	const defaultOptions = {
		parse_mode: "Markdown",
		disable_web_page_preview: true,
	};

	return bot.sendMessage(chatId, message, defaultOptions);
};
