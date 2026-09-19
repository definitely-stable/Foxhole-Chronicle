# Foxhole Chronicle — Map Presentation Contract

Status: **Authoritative working specification**

Baseline: **2026-09-19**

This document defines the presentation boundary for War Replay.

Replay is a historical projection of Chronicle-observed public state. It is not a tactical live-map product.

## 1. Scope

P0 Replay map content is intentionally narrow:

- Chronicle regions required by the selected war;
- canonical historical objectives allowed by the active taxonomy;
- observed owner/state;
- replay evidence class;
- coverage/uncertainty;
- minimal region/background context needed to understand position.

P0 MUST NOT add:

- route planning;
- artillery/range tooling;
- private/regiment markers;
- player positions;
- facility planning;
- resource/logistics overlays merely because the source exposes map items;
- tactical live-map interaction patterns unrelated to historical inspection.

## 2. Coordinate spaces

Chronicle keeps three coordinate concepts separate.

### 2.1 Source region coordinates

War API map items provide normalized x/y coordinates within a source map/region.

These values are preserved exactly as source evidence.

Chronicle MUST NOT treat undocumented origin/orientation or cross-war world placement as upstream guarantees.

### 2.2 Presentation region coordinates

A versioned Chronicle transform maps source-region normalized coordinates into the renderer's local region plane.

The transform is identified by:

- map_layout_version;
- region_transform_version;
- source map/region identity.

A transform MUST be validated against real map/static reference evidence before release.

### 2.3 World/layout composition

Placing multiple regions into one whole-war Replay surface is a Chronicle presentation/layout concern.

Region world placement MUST come from a versioned map-layout definition or validated asset/layout source. It MUST NOT be inferred ad hoc in browser code.

If a whole-world layout is not yet validated for a ruleset/map revision, Chronicle MAY ship region-focused Replay before pretending to know a complete world composition.

## 3. Versioned layout model

The Replay manifest SHOULD expose a presentation section containing at least:

~~~text
mapLayoutVersion
rendererContractVersion
regions[]
  canonicalRegionId
  sourceMapName
  regionTransformVersion
  presentationBounds
  transform
  backgroundAssetRevision? 
~~~

Objective positions remain canonical/source-linked data. Presentation transforms are versioned rendering metadata.

A layout/transform change MUST NOT rewrite raw source coordinates.

## 4. Transform requirements

A region transform MUST be deterministic.

The implementation MAY use affine/matrix transforms or an equivalent explicit representation, but MUST NOT scatter coordinate conversion constants across UI components.

One project-owned transform module owns:

~~~text
source normalized region x/y
  -> presentation region coordinates
  -> optional world/layout coordinates
~~~

Tests use fixed input/output fixtures.

Origin inversion, axis swap, rotation, scaling and translation are explicit transform parameters when needed; none are assumed merely from current visual coincidence.

## 5. Background/asset policy

Replay correctness MUST NOT depend on a decorative background image.

A background may be used only when:

- its use is allowed under Chronicle's existing source/data policy;
- its revision/layout is known;
- objective positions can be validated against it.

If an approved background is unavailable, Chronicle renders a neutral region/layout surface rather than using an unverified asset.

## 6. Objective rendering

P0 renders only objective families accepted by the active objective taxonomy/identity version.

Every rendered objective binds to:

- canonical objective ID;
- objective revision;
- identity resolution version;
- source/presentation position;
- observed state;
- replayEvidenceClass.

Unresolved/ambiguous objective identity MUST NOT be silently snapped to the nearest canonical marker.

## 7. Evidence visualization

Replay MUST encode evidence state independently from faction color.

Baseline classes:

- observed_exact;
- supported_continuity;
- transition_uncertain;
- last_known;
- no_coverage.

Faction color answers "what state was observed/last known?".

Shape/pattern/opacity/outline plus accessible text answers "how strongly does Chronicle support this state at the selected instant?".

A transition-uncertain objective MAY show previous/current states together, but MUST NOT choose one as exact solely for visual convenience.

## 8. Timeline synchronization

Map presentation consumes the same absolute at cursor as War Timeline.

Selecting an objective/change MAY:

- focus the region;
- highlight the objective;
- move the shared cursor to an observation/change boundary or selected instant.

Map interaction MUST NOT create a second independent replay clock.

## 9. Renderer dependency

No map-renderer library is mandated before implementation profiling.

Start with the simplest rendering technology that satisfies:

- deterministic region transforms;
- pan/zoom;
- objective markers;
- uncertainty encoding;
- keyboard/accessibility requirements;
- smooth local playback;
- acceptable bundle/runtime cost.

Leaflet, MapLibre, PixiJS or another renderer requires demonstrated fit; none is an architectural default.

The chosen renderer does not own canonical state, identity, coordinate semantics or replay evidence classification.

## 10. Performance model

Replay rendering is client-interactive, but data loading remains bounded.

The renderer receives:

- cached manifest/layout metadata;
- baseline state;
- buffered change ranges;
- current shared cursor.

It MUST NOT:

- refetch full map state per animation frame;
- recompute identity matching in the browser;
- parse raw War API payloads in the browser.

## 11. Accessibility

The Replay surface MUST provide:

- keyboard-operable seek/focus;
- textual selected-time state;
- accessible objective labels/details;
- non-color evidence encoding;
- reduced-motion-safe playback;
- a non-animated inspection mode.

Canvas-only implementations MUST provide an accessible parallel semantic representation for interactive objectives/selected state.

## 12. Acceptance criteria

Map presentation is implementation-ready when:

1. source coordinates and presentation coordinates are separate types/concepts;
2. one versioned transform path owns coordinate conversion;
3. whole-world region placement is versioned and validated rather than guessed;
4. raw coordinates survive presentation-transform changes;
5. objective identity ambiguity is not hidden by renderer snapping;
6. evidence classes are visible without relying on color;
7. Replay works without tactical-map features;
8. renderer choice remains replaceable behind the presentation contract;
9. transform fixtures prove deterministic placement;
10. Timeline and Replay use one shared at cursor.
