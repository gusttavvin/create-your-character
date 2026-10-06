# Art source

`monster-kit-original/` holds the untouched pieces from the original Monster Kit for the
parts that come in pairs (two eyes, two legs). The versions served from
`public/assets/monster/parts/` are true mirrors: one hand-drawn piece plus its exact
horizontal reflection, so the left and right of a pair match like a real mirror.

Regenerate a mirrored pair by taking the right-hand piece of the original, flipping it
horizontally and placing it at the mirrored position (a column at x lands at 511 - x on a
512 px canvas).

## The big tongue's tip

`mouth/big_tongue.png` in the kit is cut off at the bottom: its last row is still 130 px
wide and then the image simply stops, so the tongue and the dark lip around it end in a
straight line. The untouched file is kept here; the one served from
`public/assets/monster/parts/mouth/` has its tip grown back with

```bash
node art-source/round-tongue.cjs art-source/monster-kit-original/mouth/big_tongue.png public/assets/monster/parts/mouth/big_tongue.png 24 4
```

The two numbers are how many pixels the dark lip and the red tongue each take to close.
