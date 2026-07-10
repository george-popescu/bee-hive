# Reguli raport săptămânal "La Depozit" (de aplicat la fiecare rulare)

Ultima actualizare: 29 iun 2026. Aceste reguli sunt setate de Simona și trebuie respectate la fiecare raport săptămânal.

## Sursă date
- Folder ClickUp: **[La Depozit][La Depozit]** (id `90127530134`), lista de lucru **Backlog** (id `901212504274`).
- **Reîncarcă statusurile și lista de taskuri la FIECARE rulare** (nu folosi un set fix de taskuri/statusuri — se schimbă des).
- Săptămâna de referință = ultima săptămână încheiată (luni–duminică).

## Tab ① Săptămâna anterioară
- Afișează **toate** taskurile din folderul La Depozit pe care s-a logat timp în acea săptămână, **chiar dacă au fost închise ulterior** sau sunt excluse din alte taburi (ex. „Web APP / Mobile APP facelift" e Closed, dar apare aici cu orele logate).

## Tab ② În progres (include și „de făcut")
- Tabul „Future" a fost **eliminat**: taskurile **to-do** apar la **coada listei** din „În progres" (cu iconița de status corespunzătoare).
- Nu urmărim în planificare taskurile recurente / mereu deschise. **EXCLUDE din „În progres":**
  - `869d201wr` — [La Depozit] QA
  - `869d32fhg` — [La Depozit] PM
  - `869ca3yyc` — [La Depozit] Support Launch
  - `869apv53r` — [La Depozit] Calls
  - (rămân mereu deschise, dar nu apar în acest tab; apar totuși în tab ① dacă s-a logat pe ele)
- Coloana **„Plan"** (checkbox): PM bifează taskurile lucrate săptămâna viitoare → se evidențiază (⭐), apar și în Gantt, se rețin local.
- Sub fiecare task bifat: câmpuri de **ore pe resursă** (resursele din Owner + buton „+ resursă extra" pentru oameni care nu sunt Owner). Se rețin local.
- Selecția + alocarea se fac de obicei **după** generarea raportului.

## Tab ③ Planificare resurse
- Afișează **suma orelor pe fiecare resursă**, adunate de pe toate taskurile bifate (din alocările de la tab ②), comparate cu capacitatea. Plus detaliu pe taskuri.
- **Nu mai există tabel editabil de planificare** (înlocuit de alocările pe task).
- Capacități săptămânale: Simona **20h**, Alexandra **30h**, restul (Dragoș, George, Pierina, Alex) **40h**.

## Reset săptămânal & Gantt
- La fiecare săptămână nouă, **bifele și orele pornesc goale** (memoria locală e legată de săptămâna raportului `weekId`).
- Resursele alocabile = **doar programatorii** (Simona/PM exclusă din alocare, deși e Owner).
- Gantt = ordonat **cronologic** după start (apoi end), fără grupare pe secțiuni.

## Prezentare
- Statusul taskului = **iconiță colorată (ca în ClickUp)**, fără text, înaintea numelui.
- Coloana „Task" lată, să încapă cât mai mult din nume.
- Fără warning-uri de date lipsă; unde lipsește estimarea/deadline-ul → „—".
