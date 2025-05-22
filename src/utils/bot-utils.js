const defaultOptions = {
	parse_mode: "Markdown",
	disable_web_page_preview: true,
};

export const sendBotMessage = (
	bot,
	chatId,
	message,
	options = defaultOptions,
) => {
	return bot.sendMessage(chatId, message, options);
};
