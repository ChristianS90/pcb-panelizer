@echo off
REM ========================================
REM PCB Panelizer - Startskript
REM ========================================
REM
REM Dieses Skript startet den PCB Panelizer Entwicklungsserver
REM und öffnet die Anwendung in Google Chrome.
REM
REM URL: http://localhost:3003
REM ========================================

echo.
echo  ========================================
echo   PCB Panelizer wird gestartet...
echo  ========================================
echo.

REM Ins Projektverzeichnis wechseln
cd /d "C:\Users\SMTEC\pcb-panelizer"

REM 2 Sekunden warten, dann Chrome öffnen
start "" cmd /c "timeout /t 3 /nobreak >nul && start chrome http://localhost:3003"

REM Entwicklungsserver starten
echo  Server startet auf http://localhost:3003
echo  Druecke Ctrl+C zum Beenden
echo.
npm run dev
