# Household OS deployment

The managed website runs the Next.js application in a Node container. The image builds with the seeded SQLite database at `prisma/dev.db` and starts with `npm start` on port `3000` (or the platform-provided `PORT`).

The hosted demo is intentionally seeded and does not require a secret for its deterministic household workflows. Add `GEMINI_API_KEY` through the managed secret flow only when live Gemini document extraction or assistant behavior is desired.

The current Prisma datasource is SQLite. The database file is suitable for the seeded demonstration, but container filesystems are not a durable multi-instance database. For durable user-generated household data, migrate the Prisma datasource to the managed database capability before inviting real users.
