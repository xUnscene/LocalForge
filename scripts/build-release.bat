@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo  LocalForge Release Build
echo ============================================================
echo.

REM -- Step 1: Build Electron app
echo [1/3] Building Electron app (electron-vite)...
call npm run build
if !errorlevel! neq 0 (
    echo ERROR: Electron build failed.
    exit /b 1
)
echo Done.
echo.

REM -- Step 2: Build Python sidecar
echo [2/3] Building Python sidecar (PyInstaller)...
cd sidecar
pip install pyinstaller --quiet
pyinstaller localforge-sidecar.spec --clean --noconfirm
if !errorlevel! neq 0 (
    echo ERROR: Sidecar build failed.
    exit /b 1
)
cd ..
echo Done.
echo.

REM -- Step 3: Package installer
echo [3/3] Packaging NSIS installer (electron-builder)...
call npm run dist:win
if !errorlevel! neq 0 (
    echo ERROR: Packaging failed.
    exit /b 1
)
echo Done.
echo.

echo ============================================================
echo  Build complete.
echo  Installer: dist\LocalForge Setup 1.0.0.exe
echo ============================================================
echo.

REM List output
if exist "dist\" (
    dir /b dist\*.exe 2>nul
)

endlocal
