# Team Planning Weekly — Design

## Problem

Datele săptămânale de capacitate există deja în Team Planning, dar view-ul trebuie aliniat fidel cu `04-team-planning-weekly.html` și să rămână un overview al întregii echipe pentru toate proiectele. Calculul trebuie să deducă concediile și indisponibilitățile aprobate înainte de disponibil, iar utilizatorul trebuie să poată identifica rapid orele libere, lipsa alocării și supra-alocarea.

## Approach

Păstrăm ruta și permisiunile Team Planning și stabilizăm payload-ul săptămânal existent din `TeamLeadPlanData`. View-ul devine o componentă dedicată, cu identitatea și controalele din template, trei KPI-uri dominante, legendă din proiectele reale și un tabel al oamenilor care arată contract, concediu, disponibil, distribuție pe proiecte, alocat și liber. Săptămâna se schimbă prin navigarea Inertia existentă, iar filtrele de echipă, rol, proiect și status recalculează KPI-urile exclusiv pe rândurile vizibile.

Alternativa de a folosi agregarea lunară prorată fără distribuțiile săptămânale salvate a fost respinsă deoarece aplicația are deja `weekly_hours`; prorata rămâne doar fallback explicit. Un dashboard separat de Team Planning a fost respins deoarece ar dubla ruta, permisiunile și datele deja existente.

## Acceptance criteria

- [ ] Week view afișează implicit întreaga echipă și toate proiectele pentru săptămâna selectată, cu navigare la săptămâna precedentă și următoare.
- [ ] Pentru fiecare persoană, disponibilul este `contract − concedii − indisponibilități aprobate`, iar alocatul folosește distribuția săptămânală salvată sau fallback-ul lunar marcat explicit.
- [ ] KPI-urile arată capacitatea contractuală, disponibilul după concedii și orele nealocate, împreună cu numărul persoanelor supra-alocate.
- [ ] Tabelul afișează persoana, rolul, contractul, concediul, disponibilul, distribuția pe toate proiectele, totalul alocat și orele libere sau negative.
- [ ] Filtrele pentru echipă, rol, proiect și status de capacitate actualizează atât rândurile, cât și KPI-urile fără valori hardcodate.
- [ ] View-ul este lizibil în light și dark la desktop, tabletă și mobil; tabelul poate derula orizontal pe mobil fără pierderea coloanelor esențiale.

## Out of scope

- Editarea alocărilor direct în view-ul săptămânal.
- Modificarea taskurilor sau time entries din ClickUp.
- Integrarea Sales OS.
- Înlocuirea distribuțiilor săptămânale salvate cu valori demonstrative din HTML.
