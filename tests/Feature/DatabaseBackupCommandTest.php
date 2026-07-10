<?php

it('rejects backup attempts for non PostgreSQL connections', function () {
    config()->set('database.default', 'sqlite');

    $this->artisan('db:backup')
        ->expectsOutputToContain('numai pentru conexiunea PostgreSQL')
        ->assertFailed();
});

it('fails cleanly when the configured pg dump binary is unavailable', function () {
    config()->set('database.default', 'pgsql');
    config()->set('backup.pg_dump_binary', '/cale/inexistenta/pg_dump');

    try {
        $this->artisan('db:backup')
            ->expectsOutputToContain('pg_dump nu este disponibil')
            ->assertFailed();
    } finally {
        config()->set('database.default', 'sqlite');
    }
});
