# GymFit Spring Boot API

The frontend serves product information at `/`, sign-in at `/login`, and invite-only registration at `/register`. A Spring Security session identifies the account. MySQL stores accounts and password hashes. The UI opens the role assigned to the account and the workout draft API scopes every read and write to that account.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/auth/session` | Supplies a CSRF token and the current account, if signed in |
| POST | `/api/auth/login` | Signs in with URL-encoded `email` and `password` and the CSRF header |
| POST | `/api/auth/register` | Creates an account from a one-time invitation, email, password, and CSRF header |
| POST | `/api/auth/logout` | Ends the session using the CSRF header |
| GET | `/api/workout-drafts/{key}` | Loads the signed-in account's draft |
| PUT | `/api/workout-drafts/{key}` | Saves the signed-in account's draft using the CSRF header |

Workspace dashboards and workout drafts use authenticated MySQL records.

## Member nutrition and home workouts

Members can open `/member/diet-plan`, `/member/nutrition-diary`, `/member/nutrition-tools`, and `/member/home-workout`. These screens use the same session and CSRF protection as the workspace. Personal feature data is keyed by the current GymFit account ID. The trainer-assigned diet remains available at `/dashboard/member/diet`.

The `/api/v1/diet`, `/api/v1/foods`, `/api/v1/nutrition-diary`, `/api/v1/nutrition-tools`, and `/api/v1/home-workouts` APIs require a member account. Flyway applies the member-feature migrations in `src/main/resources/db/migration` to the configured database. Catalogs load from the bundled resources. Set `USDA_API_KEY` on the backend to enable additional food searches. Automatic diet plans use the reviewed local catalog and the bundled recommendation rules.

Feature rows copied from a separate deployment retain their original owner keys. To retain records tied to external JWT subjects or the shared local identity, migrate them using an explicit account mapping. The diet planner can archive old browser data when a signed-in member chooses to import it.

## Provision an account

Use JDK 21 and Maven. Set `DATABASE_URL` in the ignored `backend/.env` file or in the environment. See [the example file](.env.example). The supplied Aiven `ssl-mode=REQUIRED` setting requires encryption. For server identity verification, use `ssl-mode=VERIFY_IDENTITY` with the Aiven CA in the JVM truststore.

From the repository root, package the API and run the interactive provisioning command. It prompts for the email, role, and password. It connects to MySQL without starting an HTTP server.

```sh
mvn -f backend/pom.xml -DskipTests package
java -jar backend/target/gymfit-api-0.1.0-SNAPSHOT.jar --spring.profiles.active=provision-account
```

To issue an invitation instead of creating the account directly, run the provisioning command with `--invite`:

```sh
java -jar backend/target/gymfit-api-0.1.0-SNAPSHOT.jar --spring.profiles.active=provision-account --invite
```

Share the code with the specified email address. The invite expires after seven days and can be redeemed once at `/register`. Its role is assigned by the operator.

## Run locally

Start the API and frontend in separate terminals when ready.

```sh
mvn -f backend/pom.xml spring-boot:run
```

```sh
npm run dev --prefix frontend
```

The API listens on loopback port 3001 and Vite proxies `/api` to it. On startup Spring creates missing workspace tables from `schema.sql` and Flyway applies pending member-feature migrations. The configured MySQL user needs permission to create tables and read and write their rows. When the frontend is served over HTTPS, set `GYMFIT_SECURE_COOKIE=true` to restrict the session cookie to HTTPS.

Workspace pages require a signed-in account with the appropriate role in both Vite development and production. The product landing page, sign-in, and invite-only registration remain accessible without a session.
