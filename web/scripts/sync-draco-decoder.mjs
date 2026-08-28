// Copies the Draco decoder shipped with three into public/vendor/draco so the
// avatar GLB (KHR_draco_mesh_compression) can be decoded in the browser.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules/three/examples/jsm/libs/draco/gltf");
const target = join(root, "public/vendor/draco");

mkdirSync(target, { recursive: true });
for (const file of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
  copyFileSync(join(source, file), join(target, file));
}
console.log(`Draco decoder synced to ${target}`);
