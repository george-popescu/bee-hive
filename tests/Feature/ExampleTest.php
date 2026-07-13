<?php

test('returns the HiveOps application shell', function () {
    config()->set('app.name', 'BEE CODED HiveOps');

    $response = $this->get(route('home'));

    $response
        ->assertOk()
        ->assertSee('Capacity, allocation and delivery - BEE CODED HiveOps')
        ->assertSee('href="/favicon.svg"', false)
        ->assertDontSee('href="/favicon.ico"', false);
});
