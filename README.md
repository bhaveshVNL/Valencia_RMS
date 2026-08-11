# Valencia RMS

Valencia RMS contains:

- `frontend` — React + Vite dashboard
- `backend` — Node.js + Express API
- MySQL — external database (not stored in Git)

## Requirements

- Node.js 20 LTS or newer
- Git
- MySQL 8.x and MySQL Workbench, or access to a hosted MySQL database

## Run on a new Windows PC

Open PowerShell in the project root and install clean dependencies:

```powershell
npm run install:all
```

Create the private backend configuration:

```powershell
Copy-Item backend\.env.example backend\.env
```

Open `backend\.env` and set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`, and a strong `JWT_SECRET`.

If MySQL was running only on the old PC, the database data is not contained in
this source-code project. In MySQL Workbench on the old PC:

1. Open **Server > Data Export**.
2. Select the Valencia RMS database and all tables.
3. Choose **Export to Self-Contained File**, include structure and data, and run the export.
4. Move the `.sql` file to the new PC.
5. In Workbench on the new PC, open **Server > Data Import**, select that file, and import it.

Test the database credentials:

```powershell
npm run db:check
```

Start the backend in the first PowerShell window:

```powershell
npm run dev:backend
```

Start the frontend in a second PowerShell window:

```powershell
npm run dev:frontend
```

Open <http://localhost:5173>. The frontend calls `/api`, and Vite forwards
those requests to the backend at `http://localhost:5000`.

Useful tests:

- Backend health: <http://localhost:5000/api/health>
- MySQL connection: <http://localhost:5000/api/db-test>

## Upload to GitHub

The prepared project does not include the old computer's `.git` metadata,
`node_modules`, build output, or private `.env` file. From the project root:

```powershell
git init
git add .
git commit -m "Prepare Valencia RMS for deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Never commit `backend/.env`. GitHub Actions will install the dependencies,
check all backend JavaScript files, and build the frontend on every push or pull request.

The current user-management flow issues a default password to new accounts.
Change that default in the application before public production use, and require
users to change it at first login.

## Production deployment

GitHub stores and checks the code, but it does not run the Node.js backend or
MySQL database by itself. Deploy the backend to a Node.js-capable server and
the database to MySQL hosting. Then set:

- Backend `FRONTEND_URL` to the deployed frontend URL.
- Frontend `VITE_API_URL` to the public backend URL ending in `/api`.
- Backend database, JWT, and SMTP values as private environment variables on the host.

Build the frontend with:

```powershell
npm run build
```

The deployable frontend files will be created in `frontend/dist`.

## Environment files

- `backend/.env.example` documents all backend settings.
- `frontend/.env.example` documents the optional public API URL.
- Real `.env` files are ignored by Git.
"# Valencia_RMS" 
"# Valencia_RMS" 
