# Game Dev Resources

## Installed (npm — `node_modules/`)
| Package | Purpose |
|---|---|
| `three` (r185) | 3D engine — https://threejs.org/ |
| `postprocessing` | Effects (bloom, SSAO…) — pmndrs |
| `@dimforge/rapier3d-compat` | Rapier physics (WASM, no bundler config needed) |
| `gsap` | Animation |
| `vite` (dev) | Bundler / dev server |
| `puppeteer-core` (dev) | Headless-browser smoke tests (`node scripts/smoke.js`) |

## Installed (Python — `venv/`, see `requirements.txt`)
Activate: `venv\Scripts\activate`
- Flask, Flask-CORS, Flask-SQLAlchemy, SQLAlchemy — backend/DB
- bcrypt, PyJWT — auth
- openai — OpenAI API SDK (docs: https://platform.openai.com/docs)
- pymysql — optional MySQL driver
- python-dotenv — .env loading

## Three.js examples worth studying
- Skinned animation/morph: https://threejs.org/examples/#webgl_animation_skinning_morph
- GLTF loading: https://threejs.org/examples/#webgl_loader_gltf (+ Draco/compressed variants)
- Unreal bloom: https://threejs.org/examples/#webgl_postprocessing_unreal_bloom
- SSAO: https://threejs.org/examples/#webgl_postprocessing_ssao
- Shadow maps: https://threejs.org/examples/#webgl_shadowmap
- Water: https://threejs.org/examples/#webgl_water
- Physical lights: https://threejs.org/examples/#webgl_lights_physical
- Env maps: https://threejs.org/examples/#webgl_materials_envmaps
- Fog: https://threejs.org/examples/#webgl_fog
- FPS game: https://threejs.org/examples/#games_fps
- Rapier instancing: https://threejs.org/examples/#physics_rapier_instancing
- All examples: https://threejs.org/examples/

## Free asset sites (not installable — bookmark these)
**Textures / HDRIs:** Poly Haven https://polyhaven.com/ · ambientCG https://ambientcg.com/ · CC0 Textures https://cc0textures.com/ · CGBookcase https://www.cgbookcase.com/ · Humus https://www.humus.name/index.php?page=Textures · HDRI Haven https://hdrihaven.com/ · Textures.com https://www.textures.com/

**3D models:** Quaternius https://quaternius.com/ · Kenney https://kenney.nl/assets/ · Sketchfab https://sketchfab.com/ · Poly Pizza https://poly.pizza/ · Kay Lousberg https://kaylousberg.com/game-assets · BlenderKit https://www.blenderkit.com/ · TurboSquid free https://www.turbosquid.com/Search/3D-Models/free · Free3D https://www.free3d.com/ · Archive3D https://archive3d.net/

**Animation rigs:** Mixamo https://www.mixamo.com/

**Audio:** Pixabay Music https://pixabay.com/music/ · Freesound https://freesound.org/ · OpenGameArt https://opengameart.org/

**Mixed:** itch.io free assets https://itch.io/game-assets/free

## Engine references (read the source, don't install)
- Godot https://github.com/godotengine/godot
- Babylon.js https://github.com/BabylonJS/Babylon.js
- PlayCanvas https://github.com/playcanvas/engine
- OGRE https://github.com/OGRECave/ogre
- Needle Engine https://github.com/needle-tools/needle-engine

## Docs
- MDN https://developer.mozilla.org/ · Vite https://vitejs.dev/ · GSAP https://github.com/greensock/GSAP
