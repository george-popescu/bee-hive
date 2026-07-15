# Template Alignment — Design

## Problem

PM Board și Team Planning au primit funcționalități inspirate din feedback, dar ecranele existente nu reproduc fidel structura, ierarhia vizuală și flow-urile din cele șase template-uri finale. Utilizatorii nu pot identifica ușor view-urile aprobate, iar valorile contractuale neconfigurate sunt mascate uneori prin fallback-uri precum `null` afișat ca T&M. Implementarea trebuie refăcută secvențial, folosind fiecare HTML ca referință vizuală și funcțională verificabilă înainte de a trece la următorul.

## Approach

Implementăm cele șase view-uri în ordinea fișierelor, câte unul pe rând. Pentru fiecare view păstrăm componentele, rutele, permisiunile și datele dinamice existente acolo unde sunt compatibile, dar structura vizuală, controalele, stările și ierarhia informației urmează template-ul corespunzător. Fiecare pas primește teste de comportament, verificare în light/dark și capturi la desktop, tabletă și mobil; următorul view începe numai după confirmarea celui curent.

Alternativa de a continua adaptarea incrementală a UI-ului actual a fost respinsă deoarece a produs ecrane funcționale care nu arată și nu se comportă ca template-urile aprobate. Copierea HTML-urilor ca pagini statice a fost respinsă deoarece aplicația trebuie să rămână Inertia/React și să folosească date reale, permisiuni și navigare din Laravel.

## Acceptance criteria

- [ ] `01-selector-proiect.html` este reprodus în PM Boards cu selector de proiect, selector Week/Month, identificarea explicită a template-ului, KPI-uri, consum, timeline și „Next discussion” alimentate din date dinamice; un tip contractual lipsă apare ca neconfigurat, nu ca T&M.
- [ ] `02-project-board-anexe.html` este reprodus pentru proiectele de tip Anexe/Deliverables, cu filtrare pe anexă, health, planned vs delivered, agreed work și timeline contractual; datele contractuale absente sunt marcate explicit.
- [ ] `03-project-board-anexe-btl-exemplu.html` validează view-ul de Anexe pe datele ClickUp ale BTL fără valori demonstrative hardcodate și semnalizează separat deadline-ul, responsabilii sau identificatorul anexei lipsă.
- [ ] `04-team-planning-weekly.html` este reprodus ca overview săptămânal pentru întreaga echipă și toate proiectele, cu concediile deduse înaintea disponibilului și cu filtrele din template.
- [ ] `05-team-planning-monthly.html` este reprodus cu Alocat vs Realizat, o informație dominantă per celulă, selecția celulei și adăugarea progresivă a lunilor.
- [ ] `06-editor-alocari.html` este reprodus cu selectarea persoanei și lunii, distribuție săptămânală pe proiect, impact de capacitate înainte de salvare, avertizare la supra-alocare și istoric minimal.
- [ ] Fiecare view este verificat separat în light și dark la desktop, tabletă și mobil, fără erori JavaScript și fără pierderea informației esențiale.
- [ ] Fiecare view este prezentat și confirmat înainte ca implementarea să continue la următorul fișier.

## Out of scope

- Implementarea sau modificarea conectorului Sales OS în această etapă.
- Hardcodarea valorilor demonstrative, numelor, orelor sau deadline-urilor din HTML-uri.
- Publicarea pe stage sau live înainte ca view-ul curent să fie verificat și aprobat.
- Refacerea modulelor care nu apar în cele șase template-uri.

## Topics

1. `pm-project-selector` — implementarea fidelă a `01-selector-proiect.html` și eliminarea fallback-ului `null → T&M`.
2. `pm-annex-board` — implementarea fidelă a `02-project-board-anexe.html` pentru proiecte cu anexe.
3. `pm-btl-validation` — validarea template-ului de anexe cu datele reale BTL din `03-project-board-anexe-btl-exemplu.html`.
4. `team-planning-weekly` — implementarea fidelă a `04-team-planning-weekly.html`.
5. `team-planning-monthly` — implementarea fidelă a `05-team-planning-monthly.html`.
6. `allocation-editor` — implementarea fidelă a `06-editor-alocari.html`.
