<?php

use Inertia\Testing\AssertableInertia as Assert;

it('uses English as the default locale', function () {
    $this->get(route('home'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->where('locale', 'en')
            ->where('supportedLocales', ['en', 'ro']));
});

it('persists a supported locale in the session', function () {
    $this->from(route('home'))
        ->put(route('locale.update'), ['locale' => 'ro'])
        ->assertRedirect(route('home'))
        ->assertSessionHas('locale', 'ro');

    $this->get(route('home'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'ro'));
});

it('renders the Romanian application shell when selected', function () {
    $this->withSession(['locale' => 'ro'])
        ->get(route('home'))
        ->assertSuccessful()
        ->assertSee('<html lang="ro"', false)
        ->assertSee('Capacitate, alocare și livrare');
});

it('rejects unsupported locales', function () {
    $this->from(route('home'))
        ->put(route('locale.update'), ['locale' => 'fr'])
        ->assertRedirect(route('home'))
        ->assertSessionHasErrors('locale')
        ->assertSessionMissing('locale');
});
