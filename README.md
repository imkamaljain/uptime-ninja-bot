# Uptime Ninja Bot

## Overview
Uptime Ninja Bot is a Telegram bot designed to help you monitor the uptime of your websites. It allows you to add URLs to monitor, check their status, and receive notifications if they go down.

## Features
- Add and remove URLs to monitor
- Check the status of monitored URLs
- View list all monitored URLs
- Verify if the bot is active

## Commands
- `/add` - Add a new URL to monitor
- `/remove` - Remove a URL from monitoring
- `/removeall` - Clear all monitored URLs
- `/status` - Get the current status of a URL
- `/list` - Get list all monitored URLs
- `/alive` - Verify if the bot is active
- `/checkssl` - Check SSL certificate for a URL

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/imkamaljain/uptime-ninja-bot.git
   ```
2. Navigate to the project directory:
   ```bash
   cd uptime-ninja-bot
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file in the root directory and add your Telegram bot token:
   ```bash
   TELEGRAM_TOKEN=your_telegram_bot_token
   DATABASE_URL=your_database_url
   EMAIL_USER=your_email_user
   EMAIL_PASS=your_email_password
   ```
5. Start the bot:
   ```bash
   npm run dev
   ```
