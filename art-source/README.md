# Art source

`monster-kit-original/` holds the untouched pieces from the original Monster Kit for the
parts that come in pairs (two eyes, two legs). The versions served from
`public/assets/monster/parts/` are true mirrors: one hand-drawn piece plus its exact
horizontal reflection, so the left and right of a pair match like a real mirror.

Regenerate a mirrored pair by taking the right-hand piece of the original, flipping it
horizontally and placing it at the mirrored position (a column at x lands at 511 - x on a
512 px canvas).
