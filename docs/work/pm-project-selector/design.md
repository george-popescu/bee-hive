# PM Project Selector — Design

## Problem

PM Boards pornește astăzi într-un view agregat „All projects”, folosește un selector multi-proiect și afișează interfața generică existentă, nu view-ul aprobat în `01-selector-proiect.html`. În plus, proiectele fără `contract_type` sunt prezentate ca T&M, ceea ce ascunde lipsa configurării și poate încărca template-ul greșit.

## Approach

Înlocuim punctul de intrare PM Boards cu structura din `01-selector-proiect.html`: un singur proiect selectat, control Week/Month, identitatea proiectului și template-ului, trei KPI-uri, consum vs estimare, timeline și „Next discussion”. Datele sunt derivate exclusiv din proiectele, taskurile și pontajele existente; valorile demonstrative din HTML nu sunt copiate. Ruta fără proiect selectează implicit proiectul vizibil cu cele mai multe ore în perioada curentă, iar tipul contractual rămâne tri-state: T&M, Deliverables sau Not configured.

Configurarea explicită a proiectelor de referință cunoscute este păstrată printr-o migrare idempotentă. View-ul complet Deliverables nu este reconstruit aici; selectarea lui păstrează punctul de intrare 01 și va fi finalizată în topicul 02.

Alternativa de a păstra dropdown-ul multi-select și board-ul agregat a fost respinsă deoarece nu corespunde flow-ului aprobat. Inferența permanentă `null → T&M` a fost respinsă deoarece produce o clasificare falsă.

## Acceptance criteria

- [ ] Accesarea PM Boards fără query selectează un singur proiect vizibil, prioritar cel cu cele mai multe ore în perioada curentă, și nu deschide view-ul agregat „All projects”.
- [ ] Headerul reproduce structura din `01-selector-proiect.html`: context read-only, numele proiectului, descrierea contractuală, selector Project și selector View Week/Month.
- [ ] Selectarea proiectului sau perioadei navighează prin Inertia și păstrează ancora perioadei și filtrul PM aplicabil.
- [ ] View-ul afișează trei KPI-uri dinamice, consumul vs estimarea, timeline-ul ClickUp și tabelul „Next discussion”, folosind `—` sau „Date lipsă” pentru valori necunoscute.
- [ ] Un proiect cu `contract_type = null` apare „Not configured” în PM Boards și Administration și nu este tratat drept T&M.
- [ ] Proiectele de referință mapate sunt clasificate explicit: La Depozit ca T&M, MiM și BTL CRM Platform ca Deliverables.
- [ ] View-ul este lizibil și funcțional în light/dark la 1440px, 768px și 390px, fără erori JavaScript, iar structura vizuală corespunde template-ului 01.

## Out of scope

- View-ul complet pentru anexe din `02-project-board-anexe.html`.
- Validarea specifică BTL din `03-project-board-anexe-btl-exemplu.html`.
- Integrarea Sales OS sau inventarea bugetelor și deadline-urilor contractuale lipsă.
- Reintroducerea selecției multi-proiect în punctul de intrare PM Boards.

