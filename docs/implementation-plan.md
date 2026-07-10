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
- PostgreSQL este baza de date recomandată pentru producție

## Principii de implementare

1. Se lucrează la un singur milestone activ.
2. Fiecare regulă de business critică este acoperită prin teste automate.
3. Datele sunt identificate prin ID-uri interne și ID-uri ClickUp stabile, nu prin nume.
4. ClickUp este sursa de adevăr pentru taskuri și orele pontate.
5. Planificarea și configurările interne sunt deținute de aplicație.
6. Nu se introduc dependențe noi fără o decizie explicită.
7. Fiecare milestone se încheie cu teste, verificare vizuală, demo și checkpoint Git.

---

## Milestone 0 — Acord final și fundația proiectului

### Obiective

- Stabilirea deciziilor de business încă neclare.
- Inițializarea repository-ului Git și crearea commit-ului de bază.
- Confirmarea bazei de date folosite în dezvoltare și producție.
- Definirea rolurilor și a navigației principale.
- Definitivarea specificației, fără reguli contradictorii.
- Pregătirea datelor de regresie din capturi și prototipuri.
- Validarea mapării ClickUp: workspace, foldere, liste, proiecte, concedii și câmpuri custom.

### Condiție de finalizare

Nu mai există decizii blocante pentru schema bazei de date sau pentru sursele datelor.

---

## Milestone 1 — Modelul de date și motorul de calcul

### Obiective

- Modelarea persoanelor, echipelor, proiectelor și rolurilor.
- Capacitate lunară per persoană.
- Alocări lunare pe persoană × proiect × rol.
- Time entries și agregări pentru orele realizate.
- Concedii și capacitate disponibilă.
- Ajustări manuale auditate.
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

---

## Milestone 3 — View Team Lead

### Obiective

- Tab Plan în ore.
- Tab Realizat.
- Tab Plan vs Realizat.
- Filtre, totaluri, sticky headers și sortare cu localizare română.
- Autosave cu feedback vizibil și rollback la eroare.
- Adăugare pereche persoană × proiect.
- Activități interne și persoane externe.
- Permisiuni pentru Team Lead.
- Teste feature și browser.

### Condiție de finalizare

Ecranul reproduce valorile și comportamentul capturii „Plan vs Realizat”, pe aceleași date de intrare.

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
- Ore pe persoană și task.
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

Boardul reproduce regulile raportului „La Depozit”, iar selecțiile și alocările sunt persistente și disponibile utilizatorilor autorizați.

---

## Milestone 7 — Administrare și hardening

### Obiective

- Administrarea persoanelor, proiectelor, PM-ilor și template-urilor.
- Administrarea utilizatorilor și rolurilor.
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

## Decizii propuse pentru confirmare

1. Planul este stocat în **ore**, iar procentul este calculat.
2. Utilizarea este raportată la **capacitatea disponibilă după concediu**.
3. Time entries ClickUp nu sunt suprascrise; corecțiile sunt ajustări separate și auditate.
4. Write-back în ClickUp nu intră în prima versiune.
5. Acoperirea costului nu intră până la definirea formulei.
6. Planificarea săptămânală PM este salvată în aplicație.
7. PostgreSQL este baza de date țintă pentru producție.
8. Fiecare milestone se încheie cu teste, verificare vizuală, demo și commit Git.

## Definition of Done pentru fiecare milestone

Un milestone este considerat finalizat doar când:

- criteriile sale de acceptare sunt îndeplinite;
- testele relevante sunt scrise și trec;
- formatarea, linting-ul și analiza statică trec;
- interfața este verificată în browser;
- nu există erori JavaScript sau erori de aplicație cunoscute;
- funcționalitatea este demonstrată și acceptată;
- există un checkpoint Git clar.
