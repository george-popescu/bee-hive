# Operare, backup și deployment

## Model operațional recomandat

- PostgreSQL este baza de date pentru local, staging și producție; SQLite rămâne doar pentru teste.
- Procesul web, workerul de coadă și schedulerul Laravel rulează separat.
- ClickUp este read-only. Tokenul se păstrează exclusiv în secret manager sau variabile de mediu și trebuie să aibă acces la taskuri, membri, concedii și time entries pentru întregul workspace.
- `APP_DEBUG=false`, HTTPS și cookie-uri secure sunt obligatorii în producție.

## Backup

Schedulerul rulează zilnic la `02:15`:

```bash
php artisan db:backup --retention=14
```

Comanda folosește `pg_dump` în format custom, fără owner/ACL, scrie implicit în `storage/app/private/backups`, setează permisiuni `0600` și elimină copiile mai vechi decât retenția. Schedulerul o pornește în background, astfel încât un backup lung să nu blocheze sincronizarea ClickUp. În producție, directorul trebuie montat pe storage persistent și replicat criptat off-site.

Serverul trebuie să aibă pachetul PostgreSQL client. Dacă binarul nu este în `PATH`, se setează `PG_DUMP_BINARY=/cale/absolută/pg_dump`; locația și retenția pot fi suprascrise prin `BACKUP_DIRECTORY` și `BACKUP_RETENTION_DAYS`.

Recomandare inițială: RPO 24h, RTO 4h, retenție zilnică 14 zile plus o copie săptămânală timp de 8 săptămâni în storage extern. Un restore de probă se execută lunar.

Restore într-o bază goală:

```bash
createdb hive_restore
pg_restore --clean --if-exists --no-owner --no-acl --dbname=hive_restore storage/app/private/backups/hive-YYYYMMDD-HHMMSS.dump
```

Se validează apoi `php artisan migrate:status`, autentificarea, `/up`, dashboardurile și numărul de proiecte/persoane. Restore-ul nu se rulează peste producție fără fereastră aprobată și backup imediat anterior.

## Deployment

Înainte de migrare se creează un backup. Ordinea recomandată:

```bash
composer install --no-dev --prefer-dist --optimize-autoloader
npm ci
npm run build
php artisan migrate --force
php artisan db:seed --class=RolesAndPermissionsSeeder --force
php artisan optimize
php artisan queue:restart
```

După deploy se verifică:

- `GET /up` răspunde cu succes;
- workerul consumă coada și schedulerul este activ;
- pagina Administrare afișează rolurile implicite;
- un sync ClickUp manual intră în coadă și apare în istoricul de sincronizare;
- View Team Lead, Management și boardurile PM se deschid fără erori în consolă.

## Procese

Exemple pentru supervisor sau systemd:

```bash
php artisan queue:work --sleep=3 --tries=3 --timeout=900
php artisan schedule:work
```

Se păstrează minimum un worker. Jobul ClickUp este unic și are protecție la overlap; nu se pornesc sincronizări paralele manual.

Monitorizarea trebuie să alerteze dacă nu apare niciun fișier nou de backup în 26 de ore, dacă spațiul liber scade sub pragul operațional sau dacă schedulerul/workerul nu mai rulează.

## Rollback

Codul poate reveni la release-ul anterior numai dacă schema lui este compatibilă. Migrațiile care normalizează date nu sunt tratate ca mecanism de restore. Pentru incidente de date se restaurează backupul verificat, iar pentru incidente de aplicație se revine la artefactul anterior și se rulează din nou verificările de sănătate.

## Verificări de securitate

- Permisiunile sunt verificate server-side pe fiecare endpoint; ascunderea butoanelor în UI nu este control de acces.
- Colecțiile din Administrare sunt filtrate server-side: setările operaționale, utilizatorii și matricea rolurilor/auditul sunt livrate numai capabilităților dedicate.
- Rolul Admin nu poate pierde permisiunile critice, numai administratorii de roluri pot atribui sau elimina rolul Admin, iar ultimul utilizator Admin nu poate fi retrogradat sau șters.
- Identitățile ClickUp, pontajele și concediile sincronizate nu sunt editabile din Administrare.
- Dezactivarea operațională a unei persoane este păstrată la sincronizările ClickUp ulterioare.
- Ajustările de realizat sunt append-only; planul, planificarea săptămânală și schimbările administrative intră în jurnalul audit. Mutațiile și auditul lor sunt atomice, iar numele/emailul actorului rămân în jurnal chiar după ștergerea contului.
- Parametrii `pg_dump` sunt transmiși ca argumente de proces, nu prin shell, iar parola nu apare în comandă sau loguri.
