# Plan de implementare — BEE CODED Hive

## Scop

Implementarea aplicației interne pentru capacitate, alocări și board-uri PM se va face incremental, în milestone-uri independente și verificabile.

Abordarea este de tip **vertical slice**: fiecare milestone trebuie să livreze o funcționalitate completă, testată și demonstrabilă, nu doar un strat tehnic izolat.

Nivelul de reasoning folosit pentru arhitectură și implementare rămâne **Extra High**.

## Starea inițială a proiectului

- Laravel 13
- Inertia 3
- React 19
- Tailwind CSS 4
- Laravel Fortify pentru autentificare
- Pest 4 pentru testare
- 39 de teste existente, toate funcționale la începutul proiectului
- Proiectul trebuie inițializat ca repository Git înainte de prima modificare de produs
- PostgreSQL este baza de date pentru dezvoltare locală, staging și producție
- SQLite este folosit exclusiv în testele automate

## Principii de implementare

1. Se lucrează la un singur milestone activ.
2. Fiecare regulă de business critică este acoperită prin teste automate.
3. Datele sunt identificate prin ID-uri interne și ID-uri ClickUp stabile, nu prin nume.
4. ClickUp este sursa de adevăr pentru taskuri și orele pontate.
5. Planificarea și configurările interne sunt deținute de aplicație.
6. Planul de alocare este stocat canonic în ore; procentele sunt valori calculate pentru afișare.
7. Specificația scrisă este sursa regulilor de business; prototipurile sunt referințe vizuale și date de regresie.
8. Nu se introduc dependențe noi fără o decizie explicită.
9. Fiecare milestone se încheie cu teste, verificare vizuală, demo și checkpoint Git.

---

## Milestone 0 — Acord final și fundația proiectului

### Obiective

- Stabilirea deciziilor de business încă neclare.
- Inițializarea repository-ului Git și crearea commit-ului de bază.
- Confirmarea bazei de date folosite în dezvoltare și producție.
- Definirea rolurilor implicite, a permisiunilor configurabile și a navigației principale.
- Definitivarea specificației, fără reguli contradictorii.
- Pregătirea datelor de regresie din capturi și prototipuri.
- Validarea mapării ClickUp: workspace, foldere, liste, proiecte, concedii și câmpuri custom.

### Condiție de finalizare

Nu mai există decizii blocante pentru schema bazei de date sau pentru importul inițial.

---

## Milestone 1 — Modelul de date și motorul de calcul

### Obiective

- Modelarea persoanelor, echipelor și proiectelor.
- Roluri și permisiuni configurabile cu `spatie/laravel-permission`.
- Capacitate lunară per persoană.
- Alocări lunare pe persoană × proiect × rol.
- Time entries ClickUp și agregări pentru orele realizate.
- Concedii și capacitate disponibilă.
- Ajustări manuale append-only, separate de time entries, cu motiv, autor și corectare prin ajustare inversă.
- Asocierea PM ↔ proiect.
- Setări generale și perioade active.
- Servicii separate pentru:
  - Plan vs Realizat;
  - utilizare;
  - capacitate disponibilă;
  - agregarea orelor.
- Import inițial și date demonstrative.
- Teste unitare pentru formule, limite și pragurile de culoare.

### Condiție de finalizare

Rezultatele calculate coincid cu exemplele confirmate din dashboardurile actuale.

### Status implementare — 10 iulie 2026

- Finalizat: schema PostgreSQL/SQLite, modele și relații, factories, setări implicite și indexul unic pentru numele persoanei.
- Finalizat: motorul pentru capacitate disponibilă, concedii pe zile lucrătoare, plan, realizat, utilizare, medii și pragurile Plan vs Realizat.
- Finalizat: ajustări append-only și corectare prin ajustare inversă legată de original.
- Finalizat: comanda `capacity:import-workbook`, cu dry-run, import idempotent și oprire automată dacă totalurile de control nu coincid.
- Verificare completă: lint, type-check, Pint, PHPStan și 65 de teste cu 228 de aserțiuni.
- Decizie de date rezolvată: sheet-ul `Alocări` rămâne sursa canonică. Pentru `Calin Stefanescu`, controalele hardcodate din `Pe persoană` au fost corectate la `85h` în iulie 2026 și `0h` în august 2026.
- Import inițial finalizat: toate cele 120 de totaluri persoană × lună coincid; PostgreSQL conține 15 persoane, 15 proiecte și 285 de alocări lunare.

---

## Milestone 2 — Integrarea ClickUp read-only

### Obiective

- Client ClickUp izolat în spatele unei interfețe interne.
- Sincronizarea persoanelor și proiectelor.
- Sincronizarea taskurilor și time entries.
- Sincronizarea concediilor.
- Job-uri în coadă, retry și protecție împotriva rulărilor simultane.
- Sincronizare manuală și programată.
- Istoric de sincronizare: succes, eroare, interval acoperit și ultima sincronizare.
- Mapare pe ID-uri ClickUp stabile.
- Teste cu răspunsuri ClickUp simulate, fără apeluri externe reale în test suite.

### Strategie alternativă

Dacă tokenul sau mapările ClickUp nu sunt disponibile, milestone-urile de interfață pot continua temporar cu fixture-uri bazate pe datele reale din prototipuri.

### Condiție de finalizare

O sincronizare repetată este idempotentă, nu produce duplicate și nu șterge datele interne introduse manual.

### Status implementare — 10 iulie 2026

- Finalizat: client ClickUp strict read-only, izolat prin contract intern, cu autentificare raw, paginare, retry controlat și tratarea limitelor API.
- Finalizat: sincronizare idempotentă pentru membri, foldere, liste, taskuri, asignări, pontaje și concedii, fără write-back în ClickUp.
- Finalizat: mapare sigură între ierarhia de execuție ClickUp și proiectele comerciale M1. Folderele interne sunt marcate separat, potrivirile exacte și unice se pot lega automat, iar cazurile ambigue rămân `unmapped` până la o mapare explicită.
- Finalizat: istoric pentru rulări, intervale, contoare și erori; comandă `clickup:sync`, job unic cu retry/timeout și programare orară cu protecție la overlap.
- Validare automată completă: ESLint, Prettier, TypeScript, Pint, PHPStan și 81 de teste cu 336 de aserțiuni.
- Validare live: 25 membri, 20 foldere și 67 liste citite; 59 taskuri modificate în ultima zi și 1.761 înregistrări de concediu sincronizate. Cele 285 de alocări M1 au rămas neschimbate.
- Limitare operațională rămasă: tokenul curent nu poate citi pontajele celorlalți membri (`TIMEENTRY_059`). Fluxul este implementat și testat cu fixture-uri, dar validarea live a pontajelor necesită un token de Workspace Owner/Admin cu acces la time entries.

---

## Milestone 3 — View Team Lead

### Obiective

- Tab Plan în ore.
- Tab Realizat.
- Tab Plan vs Realizat.
- Filtre, totaluri, sticky headers și sortare cu localizare română.
- Autosave cu feedback vizibil și rollback la eroare.
- Adăugare pereche persoană × proiect prin ajustare, pentru utilizatorii autorizați.
- Activități interne și persoane externe.
- Permisiuni aplicate pe capabilități: implicit Team Lead poate edita planul, dar vede realizatul read-only.
- Teste feature și browser.

### Condiție de finalizare

Ecranul reproduce prezentarea și valorile capturii „Plan vs Realizat” pe aceleași date de intrare, iar corecțiile respectă fluxul de ajustări auditate și permisiunile definite în specificație.

---

## Milestone 4 — View Management

### Obiective

- Utilizare Estimat vs Realizat.
- Capacitate brută, concedii și capacitate disponibilă.
- Selector pentru 3 / 6 / toate lunile.
- Filtre pe persoană, rol și proiect.
- Afișarea persoanelor externe.
- Medii și culori conform regulilor agreate.
- Teste de regresie pentru valorile și culorile din dashboardul actual.

### Condiție de finalizare

Procentele, orele și culorile coincid cu dashboardul de referință pe aceleași date.

---

## Milestone 5 — Board PM pentru proiecte T&M

### Obiective

- Tab-uri per proiect.
- Filtrare după PM.
- Navigare pe săptămână și lună.
- Secțiuni pentru ce s-a lucrat, ce urmează, cine a lucrat și rezumat.
- Linkuri către taskurile ClickUp.
- Mod Prezentare și mod Editare.
- Ore ClickUp read-only pe persoană și task.
- Refresh ClickUp și afișarea stării ultimei sincronizări.

### Condiție de finalizare

Boardul reproduce comportamentul T&M agreat și valorile ClickUp pentru perioada selectată.

---

## Milestone 6 — Board PM pentru proiecte cu livrabile

### Obiective

- Secțiuni În progres și To-do.
- Selectarea taskurilor pentru săptămâna următoare.
- Alocarea orelor per resursă și task.
- Capacitate săptămânală per persoană.
- Planificare resurse agregată.
- Gantt bazat pe datele taskurilor.
- Excluderi configurabile pentru taskuri recurente.
- Persistarea planificării săptămânale în aplicație.

### Condiție de finalizare

Boardul generic reproduce regulile raportului de referință „La Depozit” atunci când proiectul folosește acel template/configurare, iar selecțiile și alocările sunt persistente și disponibile utilizatorilor autorizați. Alte proiecte pot avea propriile configurări fără logică hardcodată.

---

## Milestone 7 — Administrare și hardening

### Obiective

- Administrarea persoanelor, proiectelor, PM-ilor și template-urilor.
- Administrarea utilizatorilor, rolurilor și permisiunilor cu `spatie/laravel-permission`.
- Roluri implicite: Admin, Management, Team Lead și PM.
- Interfață pentru administrarea permisiunilor, accesibilă implicit rolului Admin.
- Audit complet pentru modificările importante.
- Optimizarea tabelelor și a agregărilor.
- Tratarea modificărilor concurente.
- Security review.
- Strategie de backup și deployment.
- Teste browser, build, lint, analiză statică și regresie completă.

### Condiție de finalizare

Aplicația este pregătită pentru utilizare internă în producție, cu permisiuni, audit, monitorizare și procedură de recuperare definite.

---

## Funcționalități propuse pentru faza a doua

- Write-back în ClickUp.
- Editarea time entries ClickUp din aplicație.
- Acoperirea costului, după definirea formulei și a sursei veniturilor.
- P&L, marje și pipeline comercial.
- Redis și Horizon, dacă volumul și operarea le justifică.

## Decizii confirmate

1. Planul este stocat în **ore**, iar procentul este calculat.
2. Utilizarea este raportată la **capacitatea disponibilă după concediu**.
3. Time entries ClickUp nu sunt suprascrise; corecțiile sunt ajustări separate, append-only, cu motiv și autor. Ajustările nu se editează și nu se șterg; o eroare se corectează printr-o ajustare inversă legată de original.
4. Editarea realizatului depinde de permisiune. Implicit, Admin și Management pot crea ajustări, iar Team Lead și PM au acces read-only la realizat.
5. Rolurile și permisiunile sunt implementate cu `spatie/laravel-permission`. Implicit: Admin are acces complet și gestionează permisiunile; Management are vizualizare globală și poate crea ajustări; Team Lead editează planul echipei sale; PM vede proiectele alocate și editează planificarea săptămânală. Permisiunile pot fi reconfigurate de Admin.
6. Write-back în ClickUp este în afara scope-ului curent și poate fi reevaluat într-o fază ulterioară.
7. Acoperirea costului rămâne de clarificat și nu intră în prima versiune până la definirea formulei și a datelor necesare.
8. Planificarea săptămânală PM este salvată în aplicație.
9. PostgreSQL este folosit local, în staging și în producție; SQLite este rezervat testelor automate.
10. Specificația scrisă este sursa regulilor de business; prototipurile rămân referințe vizuale și pentru regresie.
11. Integrarea ClickUp și board-urile PM sunt generice pentru toate proiectele active din Space-ul configurat. `La Depozit` este doar proiectul de referință pentru template-ul livrabile/Gantt.
12. Fiecare milestone se încheie cu teste, verificare vizuală, demo și commit Git.

## Definition of Done pentru fiecare milestone

Un milestone este considerat finalizat doar când:

- criteriile sale de acceptare sunt îndeplinite;
- testele relevante sunt scrise și trec;
- formatarea, linting-ul și analiza statică trec;
- interfața este verificată în browser;
- nu există erori JavaScript sau erori de aplicație cunoscute;
- funcționalitatea este demonstrată și acceptată;
- există un checkpoint Git clar.
