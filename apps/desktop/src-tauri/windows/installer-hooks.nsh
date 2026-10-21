; The app was called "dndbuilder" before it became DaybreakBuilder. The NSIS installer keys its
; install folder and Add/Remove Programs entry on the product name, so without this hook an
; upgrade would leave the old copy installed next to the new one. Remove it silently first.
; Saved characters and settings are not touched: they live under the bundle identifier, which
; did not change, and a silent uninstall never deletes app data.
!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $R0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\dndbuilder" "UninstallString"
  ReadRegStr $R1 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\dndbuilder" "InstallLocation"
  ${If} $R0 != ""
  ${AndIf} $R1 != ""
    ; InstallLocation is stored with quotes around it; _?= needs the bare path.
    StrCpy $R2 $R1 1
    ${If} $R2 == '"'
      StrCpy $R1 $R1 -1 1
    ${EndIf}
    ExecWait '$R0 /S _?=$R1'
    ; With _?= the uninstaller cannot delete itself, so clean up after it.
    Delete "$R1\uninstall.exe"
    RMDir "$R1"
  ${EndIf}
!macroend
