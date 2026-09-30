; NSIS hooks for the Windows installer (tauri.conf.json > bundle > windows > nsis > installerHooks).

; The app was called "Ahd" up to 0.1.2. The installer keys its folder, Start menu entry, uninstall entry and autostart
; entry on the product name, so the 3ahd install would sit next to the old one. Remove the old one first, silently:
; its uninstaller keeps settings and data unless asked to delete them (they belong to the app ID, not to the name).
!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $R9 HKCU "Software\Ahd contributors\Ahd" ""
  ${If} $R9 != ""
  ${AndIf} ${FileExists} "$R9\uninstall.exe"
    ; _?= runs the uninstaller in place instead of from a copy in %TEMP%, so ExecWait really waits for it
    ExecWait '"$R9\uninstall.exe" /S _?=$R9'
    Delete "$R9\uninstall.exe"
    RMDir "$R9"
  ${EndIf}
  DeleteRegKey /ifempty HKCU "Software\Ahd contributors"
!macroend
