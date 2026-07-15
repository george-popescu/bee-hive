<?php

use Inertia\Testing\AssertableInertia as Assert;

test('returns the HiveOps application shell', function () {
    config()->set('app.name', 'BEE CODED HiveOps');

    $response = $this->get(route('home'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('welcome')
            ->where('name', 'BEE CODED HiveOps'))
        ->assertSee('href="/favicon.svg"', false)
        ->assertDontSee('href="/favicon.ico"', false);
});
