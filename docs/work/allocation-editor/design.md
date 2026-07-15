# Allocation Editor — Design

## Problem

Editorul actual modifică alocări individuale într-un dialog și nu reproduce flow-ul unificat din `06-editor-alocari.html`, unde utilizatorul alege persoana și luna, vede toate proiectele acelei celule și ajustează distribuția săptămânală înainte de o singură salvare. Impactul asupra capacității și istoricul modificărilor trebuie să fie vizibile fără a ascunde sau a salva parțial schimbările.

## Approach

Editorul devine un panou asociat celulei selectate din Monthly view. El încarcă toate alocările persoanei pentru luna selectată într-un draft local, permite adăugarea sau eliminarea proiectelor și editarea orelor pe săptămânile care intersectează luna, apoi recalculează instant capacitatea disponibilă, totalul alocat și diferența. Salvarea reconciliază atomic toate rândurile persoană/lună într-o tranzacție Laravel și păstrează audit pentru create, update și delete; supra-alocarea produce avertizare clară, dar nu blochează salvarea.

Alternativa apelurilor independente pentru fiecare rând a fost respinsă deoarece o eroare intermediară ar lăsa luna parțial salvată. Păstrarea dialogului actual a fost respinsă deoarece nu oferă view-ul aprobat și nu arată impactul cumulat înainte de salvare. Modificarea taskurilor ClickUp a fost respinsă deoarece alocările HiveOps sunt date interne.

## Acceptance criteria

- [ ] Selectarea unei celule Monthly deschide editorul pentru persoana și luna respectivă, iar controalele Previous/Next, Person și Month schimbă contextul fără a salva automat draftul.
- [ ] Editorul afișează contractul, concediile și sărbătorile aprobate, capacitatea disponibilă, totalul alocat și realizatul nullable pentru contextul selectat.
- [ ] Fiecare rând de proiect permite editarea orelor pe săptămânile care intersectează luna, schimbarea proiectului sau anexei și eliminarea rândului; se poate adăuga un proiect care nu este deja prezent.
- [ ] Totalul lunar este suma distribuțiilor săptămânale, iar impactul asupra capacității se actualizează înainte de salvare; supra-alocarea este avertizată vizibil, dar poate fi confirmată.
- [ ] Save aplică atomic create/update/delete pentru toate rândurile persoanei și lunii, iar Discard restaurează exact ultima stare persistată.
- [ ] Istoricul minimal afișează autorul, schimbarea și momentul pentru create, update și delete, inclusiv pentru o alocare eliminată.
- [ ] Utilizatorii fără `ManageAllocations` văd datele fără controale de editare, iar scope-ul persoanelor este verificat și pe endpoint.
- [ ] Editorul este utilizabil în light și dark la desktop, tabletă și mobil, fără pierderea acțiunilor Save/Discard sau a avertizării de capacitate.

## Out of scope

- Scrierea în ClickUp sau schimbarea taskurilor sincronizate.
- Integrarea Sales OS ori editarea anexelor contractuale.
- Blocarea obligatorie a unei alocări peste capacitate.
- Modificarea capacității contractuale sau a concediilor din editor.
