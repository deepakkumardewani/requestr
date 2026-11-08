# P7 video clips (T7.4)

Recorded with `agent-browser record` against the running app (dark theme, seeded QA data via `e2e/fixtures/qa-seed.init.js`, `/api/proxy` stubbed with a static 200 JSON body so no external traffic). Viewport 960x540, encoded by `scripts/encode-intro.sh` to 800x450, 20 fps, 8 s, no audio. WebM: VP9 CRF 38. MP4: H.264 CRF 30. Poster: WebP q70 (sharp; ffmpeg lacks libwebp).

| Clip | Chain shown |
|---|---|
| clip-1 | QA - Parallel Lanes run |
| clip-2 | QA - Loop 3 Items run |
| clip-3 | QA - Merge All run |

Contact sheets of all three clips reviewed: only seeded chain/request names, no emails, keys or personal collections.

## ls -l
```
.rw-r--r--@ 35k deepakdewani1  8 Nov 16:05 clip-1.mp4
.rw-r--r--@ 49k deepakdewani1  8 Nov 16:05 clip-1.webm
.rw-r--r--@ 12k deepakdewani1  8 Nov 16:05 clip-1.webp
.rw-r--r--@ 31k deepakdewani1  8 Nov 16:05 clip-2.mp4
.rw-r--r--@ 45k deepakdewani1  8 Nov 16:05 clip-2.webm
.rw-r--r--@ 12k deepakdewani1  8 Nov 16:05 clip-2.webp
.rw-r--r--@ 26k deepakdewani1  8 Nov 16:05 clip-3.mp4
.rw-r--r--@ 41k deepakdewani1  8 Nov 16:05 clip-3.webm
.rw-r--r--@ 10k deepakdewani1  8 Nov 16:05 clip-3.webp
```

## ffprobe
```
public/intro/clip-1.mp4 h264,800,450,20/1 7.950000 
public/intro/clip-2.mp4 h264,800,450,20/1 7.950000 
public/intro/clip-3.mp4 h264,800,450,20/1 7.950000 
public/intro/clip-1.webm vp9,800,450,20/1 7.950000 
public/intro/clip-2.webm vp9,800,450,20/1 7.950000 
public/intro/clip-3.webm vp9,800,450,20/1 7.950000 
```

Total: 272 KB (cap 2560).
