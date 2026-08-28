# Chibi Band Avatar

Six chibi band avatars for Unshatter Game, generated headless from Blender.

## Files

- Base mesh: `source/chibi-base.obj` (+ `.mtl`) — see **Licensing** below
- Modelled hair: `source/hair-long-anime.fbx` (Emily) and
  `source/hair-ayato.obj` (Joe) — see **Licensing** below
- Modelled cap: `source/cap-black.fbx` — see **Licensing** below
- Generated source: `source/chibi-band-avatar.blend`
- Runtime GLB: `public/assets/3d/game/avatars/chibi-band/chibi-band-avatar.glb`
- Runtime manifest: `public/assets/3d/game/avatars/chibi-band/manifest.json`

## Regenerate

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/assets/3d/generate-chibi-band-avatar.py
```

Useful flags (after `--`):

- `--only <preset-id>` builds a single preset, for fast iteration.
- `--verbose` prints a per-part triangle breakdown, which is how the shell
  parameters get tuned.

Note that `--only` rewrites the shared GLB with a single avatar in it. Always
finish with a full run before committing.

## How it is built

Only the body comes from the base mesh. Hair, beards, garments and the cap are
*derived* from it: mask a region of the body, inflate it along its normals, and
solidify. Clothing therefore always fits the body it was cut from, and a new
outfit is a mask plus a few numbers rather than a new sculpt.

Three details in that pipeline are load-bearing and easy to break:

- **Shading overrides.** The base OBJ carries one normal per face, so the
  importer leaves custom split normals *and* a fully sharp edge set behind.
  Either one silently overrides `use_smooth` and flat-shades the whole avatar.
  `shade_smooth()` clears all three; do not replace it with a plain loop over
  `polygon.use_smooth`.
- **Inflate before cutting.** Scaling a shell about the head centre also drags
  its lower rim downward. Hair is scaled first and *then* clamped to the
  hairline, otherwise the volume creeps down over the eyes.
- **The scalp is painted on the head, not built.** Strand assets are modelled
  around a scalp the artist supplied; drop them on a bare head and the parting
  shows skin. Rather than hide a shell under the strands — extra triangles,
  z-fighting against them, and a fit to keep tuning — `bake_vertex_colour`
  repaints the head's own scalp in the hair colour above `SCALP_LINE`. A gap
  then simply shows hair. Keep that line high and steeply raked at the front:
  it only has to reach where hair actually sits. Paint that runs down the
  forehead is hidden by nothing and just reads as a yellow forehead. A style
  can override the line with its own `scalp_line`: Joe's cards thin out over
  the temples, so his reaches further down the sides with a steeper rake,
  which keeps the front exactly where the default puts it.
- **Hair length is compressed, its cap is not.** A chibi head is so large
  relative to the body that hair authored at human proportions hangs past the
  knees. Only the length below `crown_span` is squashed: squash the cap too
  and it flattens, stops following the round skull, and the scalp shows at the
  hairline.
- **Some hair is fitted, not generated.** Styles listed in `IMPORTED_HAIR` come
  from a modelled card asset, which carries strand definition a masked shell
  cannot. Fitting is a plain uniform scale plus a separate depth stretch: the
  chibi skull is deeper than it is wide and the asset is the reverse, so a
  uniform fit leaves the back of the head poking through. Do not try to project
  the strands onto the skull to make the cap hug it — that pulls the cards out
  of the layering they were modelled with and the scalp shows through the gaps.
  Scale until the shell simply encloses the head instead.
- **A swept cut is centred on its origin, not its bounds.** The bounding box
  is a fair stand-in for the skull under a symmetric strand asset. Joe's cards
  are not symmetric: the bangs sweep to one side and one side strand is longer,
  so the box centre sits off the skull and centring on it slid the whole hair
  4 cm sideways — a bare temple on one side, a hair overhang on the other,
  which reads as crooked hair rather than as a fit bug. Card assets are
  modelled around a head at their own origin; `centre="origin"` uses that.
- **Card assets exported through OBJ are welded on import.** The OBJ format
  splits a vertex wherever its UVs do, so Joe's hair arrived with 6636
  vertices for 4200 unique positions. Nothing here samples a texture, so
  `weld` merges them back: 37% fewer vertices for the same cards, and smooth
  shading runs along a strip instead of creasing at every seam. It is opt-in
  per style so the strand asset's decimation stays byte-for-byte what it was.
- **A cap is aligned on its crown, never on its bounding box.** The brim
  reaches far forward, so the box centre sits well ahead of the crown. Centre
  on it and the crown parks too far back: the forehead juts out in front of
  the crown's front edge and reads as a band of bare skin under the cap, which
  looks like a colour bug rather than a placement one. `build_imported_accessory`
  splits brim from crown by height (`brim_span`) and lines the crown's front
  edge up against the head's.
- **Crown height is eased in from the band upward.** Stretching the whole prop
  from its lowest point lifts the crown away from the brim and opens a gap.
- **Hard-surface props shade by angle, not `shade_smooth`.** `shade_smooth`
  strips every sharp-edge flag, which is exactly what the organic body wants
  and exactly wrong for a cap: smoothing across the brim edge and the panel
  seams melts it into a blob. `shade_auto_smooth` keeps creases past ~34°.
  This one is easy to miss because it looks fine in a wireframe or a triangle
  count and only shows up in a render.
- **Modelled props are fitted like the hair, with two differences.** A cap is
  one closed shell, so it stays in `gloss` and keeps its backface culling. Its
  height is fitted separately from its width, because a real cap crown is
  shallow next to a chibi skull and the head would otherwise stand taller than
  the cap. The FBX also ships with inconsistent winding, so its normals are
  recalculated on import.
- **The cap does not correct its crown against the skull.** It used to, and it
  dented the crown. Mike wears the buzz shell underneath, which is nearly as
  dark as the cap, so the little the skull grazes is invisible. Anything worn
  over a light-haired preset would need that correction back.
- **Modelled hair gets its own two-sided material.** Those cards are open and
  single-sided, so their back faces have to draw. Keeping them out of `gloss`
  means the closed meshes — the eyes, and every derived hair shell — keep their
  backface culling. It costs one extra draw call, on those presets only.
- **Draco quantisation is tightened past the defaults.** Those defaults assume
  detailed, textured meshes. This asset is flat colours on a small character,
  so colour and the skin weights need far fewer bits. Dropping them cost 26% of
  the file with no visible change; re-check a render if you raise them.
- **No UVs are exported.** Every colour is baked into `COLOR_0` and nothing
  samples a texture, so `export_texcoords` is off; leaving it on cost 24% of
  the GLB for data no shader reads.
- **Hair length is grown, not masked.** A shell cut off the head stops where
  the head stops, which reads as a helmet. `grow_curtain` extrudes the back
  and side rim downward in rings, before Solidify so the length picks up the
  same thickness. Each ring narrows in X only — scaling it toward its own
  centroid in both axes collapses the ring into a tube that hangs like a tail.
- **Arm posing is Z-gated.** The thigh silhouette also passes the
  `|x| > ARM_X` test the arms use, so `pose_arms_down` gates on `CHEST_Z` too.
  Without it the legs get swept outward with the arms.

## Runtime contract

- The glTF scene has one canonical root, `AvatarRig`, containing one
  `ChibiArmature`.
- Every visual preset is exported as a mesh set named
  `Mesh_<preset-id>_<group>`. The runtime clones `AvatarRig`, keeps only the
  selected preset meshes, and removes the other visual variants from that
  clone.
- The shared rig is a skinned armature whose canonical, unprefixed bones are
  named to match `bindChibiAvatarRig` in `create-chibi-avatar.ts`: `body`,
  `head-pivot`, `left-arm-pivot`, `right-arm-pivot`, `left-leg-pivot`,
  `right-leg-pivot`. Arms hang at the sides so a bone's local X rotation reads
  as a forward swing.
- Clone with `SkeletonUtils.clone()`. A plain `Object3D.clone()` leaves every
  copy bound to the original skeleton, so all players would share one pose.
- Flat colours are baked into a `COLOR_0` vertex colour layer and each visible
  avatar collapses to two materials (matte and glossy), or three when the
  preset uses modelled hair cards. Geometry and materials are shared across
  every player instance and are flagged `userData.shared` so
  `disposeObject3D` leaves them alone.
- Scale on `stats.bodyHeight` from the manifest (sole to crown, hair
  excluded), never on a measured bounding box. Total height differs per preset
  because hair volume does, so normalising on it would shrink Brad's body to
  pay for his afro — and `Box3.setFromObject` over a `SkinnedMesh` depends on
  when the skeleton was last updated, so it is not reliable at load time.
- The GLB is Draco compressed. `GLTFLoader` needs a `DRACOLoader` pointed at
  `/vendor/draco/`, which `npm run sync:draco-decoder` populates.

## Animation

`animateChibiAvatar` drives the bones directly; there are no baked clips. It
takes a `delta` and damps every joint toward a target angle, so the pose
survives a frame-rate change and does not snap between states.

- **Walk / run** share one gait shape and differ only in frequency, swing
  amplitude and forward lean. Sprint is Shift, wired through
  `keyboard-controls.isSprinting()`.
- **Jump** replaces the whole silhouette rather than layering on the walk.
  `jumpPhase` is the vertical velocity normalised to takeoff speed (+1 rising,
  -1 falling), which tucks the legs and throws the arms up at the apex, then
  lets the legs reach for the ground on the way down.

Every angle is applied **relative to the bone's rest orientation**, never by
writing `rotation.x` directly. Bones exported from Blender carry a rest
rotation — the leg bones point down, so theirs is roughly a half turn — and
assigning an absolute `rotation.x` wipes it, folding the legs up inside the
torso on the very first frame. `bindChibiAvatarRig` snapshots each bone's rest
quaternion and `driveJoint` composes `rest * delta` onto it. This is the single
easiest thing to break here, and it looks like "the avatar has no animation"
rather than like a rotation bug, because the pose is already destroyed before
any swing is applied.

On a hanging limb, **negative** relative `rotation.x` swings it forward. This
is why the generator poses the arms down instead of leaving the base mesh in
its T-pose: in a T-pose the arm bone runs along X and a local X rotation
twists the limb instead of swinging it.

## Portraits

The generator also renders `portraits/<first-name>.png` — a head-and-shoulders
shot of each finished avatar, framed off the crown so hair volume does not
change how large the face reads. `AvatarPicker` shows these next to the
member's first name, so the menu always matches what spawns in the world. They
are re-rendered on every build; there is nothing to keep in sync by hand.

## Licensing

`source/chibi-base.obj`, `source/hair-long-anime.fbx`, `source/hair-ayato.obj`
and `source/cap-black.fbx`
are third-party models, vendored here from local downloads. The project owner
has confirmed a commercial-use licence for them. The cap shipped with PBR
textures; they are deliberately not used — the cap is a flat colour like
everything else, which keeps the asset free of textures entirely. They ship inside the runtime GLB, so those
licences have to cover redistribution in a compiled web asset — re-check
before any public release, and record the vendor and licence terms here once
known.

Everything else in this asset (derived hair, beards, garments, face, rig,
colours) is generated by the project's own script.
