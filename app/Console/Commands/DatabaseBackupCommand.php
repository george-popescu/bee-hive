<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

#[Signature('db:backup {--retention= : Numărul de zile păstrate} {--path= : Directorul de backup}')]
#[Description('Creează un backup PostgreSQL comprimat și elimină copiile expirate')]
class DatabaseBackupCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (config('database.default') !== 'pgsql') {
            $this->components->error('Backup-ul automat este disponibil numai pentru conexiunea PostgreSQL.');

            return self::FAILURE;
        }

        $connection = config('database.connections.pgsql');
        $directory = (string) ($this->option('path') ?: config('backup.directory'));
        $retentionDays = max(1, (int) ($this->option('retention') ?: config('backup.retention_days')));
        $configuredBinary = (string) config('backup.pg_dump_binary');
        $binary = str_contains($configuredBinary, '/')
            ? (is_executable($configuredBinary) ? $configuredBinary : null)
            : (new ExecutableFinder)->find($configuredBinary);

        if ($binary === null) {
            $this->components->error('pg_dump nu este disponibil. Instalează PostgreSQL client sau setează PG_DUMP_BINARY.');

            return self::FAILURE;
        }

        File::ensureDirectoryExists($directory, 0700, true);
        $filename = sprintf('%s/hive-%s.dump', rtrim($directory, '/'), now()->utc()->format('Ymd-His'));
        $process = new Process([
            $binary,
            '--format=custom',
            '--compress=9',
            '--no-owner',
            '--no-acl',
            '--file='.$filename,
            '--host='.(string) $connection['host'],
            '--port='.(string) $connection['port'],
            '--username='.(string) $connection['username'],
            (string) $connection['database'],
        ], base_path(), ['PGPASSWORD' => (string) $connection['password']], null, 3600);

        try {
            $process->mustRun();
            chmod($filename, 0600);
        } catch (ProcessFailedException $exception) {
            File::delete($filename);
            report($exception);
            $this->components->error('Backup-ul PostgreSQL a eșuat. Verifică logurile aplicației.');

            return self::FAILURE;
        }

        $cutoff = now()->subDays($retentionDays)->getTimestamp();

        foreach (File::glob(rtrim($directory, '/').'/hive-*.dump') ?: [] as $backup) {
            if (File::lastModified($backup) < $cutoff) {
                File::delete($backup);
            }
        }

        $this->components->info('Backup creat: '.$filename);

        return self::SUCCESS;
    }
}
