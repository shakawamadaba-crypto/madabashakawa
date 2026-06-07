# AI Agent Instructions

## Project overview
- This repository is a small web application with static HTML pages and a Node.js backend.
- The backend is implemented in `server.js` using Express, and it exposes a WhatsApp webhook endpoint plus a message API.
- Static UI files are plain HTML pages in the repository root, including Arabic-named pages.

## Key files
- `server.js` - Express server, webhook endpoint at `/incoming-message`, message list API at `/messages`
- `package.json` - runtime scripts and dependencies
- `adminpage.html`, `mainsite.html`, and the Arabic HTML files - front-end pages
- `.env` - environment variables for port configuration and Twilio integration

## How to run
- Use `npm start` to launch the server
- The server listens on `process.env.PORT` or `3000`

## Important behavior
- Incoming WhatsApp message payloads are stored in-memory in `messages`
- The server returns an empty TwiML response from `/incoming-message`
- Messages are kept only in the running process and older messages are trimmed to the last 100 every minute

## Agent guidance
- Do not assume a build pipeline or test framework exists; there are no build scripts or tests in this repo
- Preserve UTF-8 and Arabic filenames when editing files in the workspace
- Prefer modifying `server.js` and `package.json` for backend/server changes
- For front-end changes, update the standalone HTML files directly
- Keep the backend simple: there is no static server configured for HTML pages in `server.js`

## Useful notes
- Dependencies: `express`, `body-parser`, `cors`, `dotenv`, `multer`, `twilio`
- The webhook is intended for Twilio WhatsApp integration; payload fields include `From`, `Body`, `NumMedia`, and `MediaUrl0`
- Avoid adding unnecessary complexity unless explicitly requested by the user
