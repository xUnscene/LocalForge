@echo off
echo Building LocalForge sidecar...
pip install pyinstaller
pyinstaller localforge-sidecar.spec --clean
echo.
echo Done. Output: sidecar\dist\localforge-sidecar.exe
