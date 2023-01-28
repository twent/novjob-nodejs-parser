# Async Node.js Parser

Asynchroniously getting data and saves it to CSV files, PostgreSQL (or other DB).
The most important config in `.env` file.

## Used:

1. Node.js
2. Prisma ORM
3. JSDOM
4. Async Queue from Node.js library
5. PostgreSQL in Docker

## Run:

1. Clone this repo
2. Create your `.env` from `.env.example`. Configure workers count, delay between tasks, db connection.
3. Run `yarn install`
4. Run `docker compose up -d` if you want to use PostgreSQL in Docker or change Prisma config for SQLite or other
5. Run `yarn migrate`
6. Run `yarn start`, then check `data` catalog and your DB
7. Run `yarn db:admin` for integrated DB Admin UI from Prisma ORM
