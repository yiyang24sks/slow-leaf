@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\pythonw.exe (
  echo First run: setting up Slow Leaf. This takes a few minutes...
  py -3 -m venv .venv 2>nul || python -m venv .venv
  .venv\Scripts\python.exe -m pip install --upgrade pip
  .venv\Scripts\python.exe -m pip install -r requirements.txt
  .venv\Scripts\python.exe -m pip install -r requirements-media.txt || echo Media detection skipped - everything else still works.
)
start "" .venv\Scripts\pythonw.exe app.py %*
