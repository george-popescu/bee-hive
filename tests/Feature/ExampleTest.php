<?php

test('returns the HiveOps application shell', function () {
    config()->set('app.name', 'BEE CODED HiveOps');

    $response = $this->get(route('home'));

    $response
        ->assertOk()
        ->assertSee('<title>BEE CODED HiveOps</title>', false)
        ->assertSee('href="/favicon.svg"', false)
        ->assertDontSee('href="/favicon.ico"', false);
});
