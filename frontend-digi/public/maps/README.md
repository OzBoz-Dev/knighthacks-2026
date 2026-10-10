# Globe geography

`land-110m.json` is the GeoJSON conversion of `world-atlas@2.0.2/land-110m.json`.
The source uses Natural Earth 1:110m land geometry. The data ships locally; no map service or key is required.

Source: https://github.com/topojson/world-atlas
Natural Earth: https://www.naturalearthdata.com/about/terms-of-use/
The world-atlas license is in `WORLD-ATLAS-LICENSE.txt`.

Regenerate from the frontend directory:

```sh
node --input-type=module -e 'import fs from "node:fs"; import {feature} from "topojson-client"; const world=JSON.parse(fs.readFileSync("node_modules/world-atlas/land-110m.json","utf8")); fs.writeFileSync("public/maps/land-110m.json",JSON.stringify(feature(world,world.objects.land)));'
```
