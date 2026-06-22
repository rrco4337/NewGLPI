@echo off
REM Script to copy Bootstrap Icons fonts to public folder for offline support

REM Create fonts directory if it doesn't exist
if not exist "public\fonts" mkdir public\fonts

REM Copy Bootstrap Icons font files from node_modules
if exist "node_modules\bootstrap-icons\font" (
  copy "node_modules\bootstrap-icons\font\bootstrap-icons.woff2" "public\fonts\"
  copy "node_modules\bootstrap-icons\font\bootstrap-icons.woff" "public\fonts\"
  echo Bootstrap Icons fonts copied to public/fonts/
) else (
  echo Bootstrap Icons fonts not found in node_modules
  exit /b 1
)

echo Fonts setup complete for offline support
