La Depozit — Board PM săptămânal
================================

Fișiere:
- La_Depozit_Board_PM_Saptamanal.html  → board-ul (deschide-l în browser)
- ladepozit_weekly_data.json           → datele săptămânii (extras din ClickUp)
- ladepozit_report_rules.md            → regulile după care se generează raportul

Cum se generează:
- Automat, în fiecare LUNI la 08:00 (task programat „la-depozit-weekly-report").
- Sursă: ClickUp, folderul La Depozit (lista Backlog). Statusurile și datele se
  reîncarcă la fiecare rulare.
- „Săptămâna anterioară" = ultima săptămână încheiată (luni–duminică).

Cele 4 taburi:
1) Săptămâna anterioară — tot ce s-a logat (chiar dacă taskul s-a închis între timp),
   cine + ore, și progresul total față de estimarea din ClickUp.
2) În progres — taskurile active + cele „de făcut" (to-do) la coada listei.
   Bifează în coloana „Plan" taskurile din săptămâna viitoare; sub fiecare task bifat
   introduci orele pe fiecare resursă (doar programatorii; PM/Simona nu e resursă).
3) Planificare resurse — suma orelor pe fiecare programator (din alocările de la tab 2)
   față de capacitate (Alexandra 30h, restul 40h), + detaliu pe taskuri.
4) Gantt — taskurile cu start și deadline, ordonate cronologic; linie roșie = săptămâna curentă.

Note:
- Statusul apare ca iconiță colorată (ca în ClickUp).
- Bifele și orele introduse manual se rețin local și se resetează la fiecare săptămână nouă.
- Ce lipsește în ClickUp (estimare/deadline) apare ca „—".
