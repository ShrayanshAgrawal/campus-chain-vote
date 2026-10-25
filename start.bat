@echo off
echo ====================================================================
echo  CampusChainVote - One-Click Setup and Start
echo ====================================================================

SET PGBIN=C:\Program Files\PostgreSQL\18\bin
SET PGPASSWORD=postgres

echo.
echo [1/5] Creating database...
"%PGBIN%\psql.exe" -U postgres -c "CREATE DATABASE campus_vote;" 2>nul
echo     Done.

echo.
echo [2/5] Generating Prisma client...
cd backend
call node_modules\.bin\prisma generate
cd ..

echo.
echo [3/5] Pushing database schema...
cd backend
call node_modules\.bin\prisma db push
cd ..

echo.
echo [4/5] Seeding database (students, elections, candidates)...
cd backend
call node prisma/seed.js
cd ..

echo.
echo [5/5] Starting servers...
echo.
echo ====================================================================
echo  Backend  : http://localhost:5000
echo  Frontend : http://localhost:5173
echo  Login with: ADMIN001 (admin) or any enrollment number
echo ====================================================================
echo.

start "Backend - CampusChainVote" cmd /k "cd /d %~dp0backend && set PGPASSWORD=postgres && node src/server.js"
timeout /t 3 /nobreak >nul
start "Frontend - CampusChainVote" cmd /k "cd /d %~dp0frontend && node_modules\.bin\vite --host --port 5173"

echo Both servers starting in separate windows...
echo Open http://localhost:5173 in your browser!
echo.
pause
