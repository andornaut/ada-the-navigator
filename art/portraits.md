# Portraits

Approved portraits reused from the Archie repository (`andornaut/archies-dog-walks`) at exact commit `8124ae5a9281e67b51191d8a9a609fc7f76480af`.

Ada is the brown/dark-skinned girl depicted in the source art. The dog portrait retains the source appearance; no breed or character name is assigned here. Toronto refers to the city, not the dog.

## Geometry and tags

Every frame is 32 × 32 pixels, untrimmed, with a 1000 ms duration. Ada's sheet is 64 × 32 pixels; the dog's sheet is 96 × 32 pixels.

| Portrait | happy | neutral | upset |
| --- | --- | --- | --- |
| Ada | Frame 0 | Frame 1 | Not present |
| Dog | Frame 0 | Frame 1 | Frame 2 |

PNG files are byte-for-byte copies. JSON changes only `meta.image` to the destination filename, `ada.png` or `dog.png`. Source frame keys, geometry, durations and tags are preserved.

## Provenance and SHA-256

- Source: `public/art/sprites/face-walker-ada.png`
  - SHA-256: `46633962fb8d3d4757954009b614a940d0e918dccb90e350b4b7e60d2f9deaa3`
  - Destination: `public/art/portraits/ada.png`
  - SHA-256: `46633962fb8d3d4757954009b614a940d0e918dccb90e350b4b7e60d2f9deaa3`
- Source: `public/art/sprites/face-walker-ada.json`
  - SHA-256: `d6774039c54f424b91d7040ca11cfc9c8b3dc0492dabb63b1ca3b03a482d215a`
  - Destination: `public/art/portraits/ada.json`
  - SHA-256: `a5a62b9061fd801ea4301d60bf888f8390ee0affd38d6d3fb7a9c57e6ff37361`
- Source: `public/art/sprites/face-dog-archie.png`
  - SHA-256: `20aaa3fa0ef7dacb3ee7902c8536c0f27ff9eb01a40bd646427eabb8a6a60463`
  - Destination: `public/art/portraits/dog.png`
  - SHA-256: `20aaa3fa0ef7dacb3ee7902c8536c0f27ff9eb01a40bd646427eabb8a6a60463`
- Source: `public/art/sprites/face-dog-archie.json`
  - SHA-256: `a167ac587f398a119a839684e0187b267108c38ac9ad4983781b59d64eb4bd11`
  - Destination: `public/art/portraits/dog.json`
  - SHA-256: `c469332c04dd6c1e97c5595aaf0fada8c1ed68fe9ca80e6a554f4232a4bb95d0`

## Verification limits

All four tracked source files match their committed blobs at the pinned source commit by Git object hash and byte comparison. Destination PNG bytes match the sources. Tests, builds, lint and containers were not run, as explicitly requested for this handoff. Integration checks remain deferred.
