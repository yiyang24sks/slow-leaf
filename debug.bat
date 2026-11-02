@echo off
cd /d "%~dp0"
rem Runs with a console so errors are visible. Plant grows 60x faster for testing.
.venv\Scripts\python.exe app.py --speed 60
pause
