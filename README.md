# AEROVANT

[![AEROVANT](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/barongz1/aerovant/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/barongz1/aerovant/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**AEROVANT** adalah game pesawat terbang 3D offline — 100% lokal, tanpa internet, tanpa file luar. Terbangkan pesawat original bertema Nusantara melintasi lembah, pegunungan berapi, sungai berliku, kota pencakar langit, dan landasan pacu aktif.

## Yang ada di dalam game

- **3 pesawat dengan model 3D dan stat berbeda** — stat benar-benar mengubah cara terbang:
  - **Elang Jawa** (speed 10, handling 18, akselerasi 12, stabilitas 12) — jet pencegat lincah, belok tajam, cocok untuk koridor sempit.
  - **Cendrawasih** (speed 15, handling 12, akselerasi 18, stabilitas 10) — jet panah tercepat, melesat lurus, butuh ruang belok lebar.
  - **Jalak Bali** (speed 12, handling 14, akselerasi 12, stabilitas 18) — turboprop kokoh dengan baling-baling berputar, paling stabil dan mudah dikendalikan.
- **5 map yang benar-benar berbeda**: Kepulauan Nusantara (tropis), Puncak Salju (salju turun), Kawah Api (lava menyala, abu beterbangan), Orbit Antariksa (langit berbintang, asteroid, gravitasi ringan), Gurun Pasir (bukit pasir, oasis, debu panas). Map yang dipilih berlaku di semua misi.
- **5 misi**: Koridor Cincin Udara (9 cincin + mendarat), Lepas Landas Fajar, Time Trial (9 cincin secepat mungkin), Pendaratan Presisi (skor dari kelembutan dan ketepatan mendarat), dan Jelajah Bebas.
- **Bahan bakar dan kerusakan**: bahan bakar habis berarti mesin mati — mendaratlah untuk isi ulang. Pendaratan keras menambah kerusakan.
- **Pesawat yang hidup**: banking saat belok, hidung ikut pitch, baling-baling berputar mengikuti throttle, roda dan flaps bergerak halus, aileron/elevator/rudder ikut bergerak, garis kecepatan saat terbang kencang.
- **HUD lengkap**: pitch ladder, heading tape, speed dan altitude tape, penanda target, minimap radar, instrumen chase, dan tiga MFD di kokpit (attitude, systems, engine).
- **Suara prosedural WebAudio**: mesin mengikuti throttle (tiap pesawat punya karakter suara sendiri), angin mengikuti kecepatan, bunyi saat lewat cincin, peringatan stall dan terrain.

## Kontrol

| Aksi | Tombol |
|---|---|
| Pitch (naik/turun) | S / W atau ↓ / ↑ |
| Roll (miring) | A / D atau ← / → |
| Kemudi mouse (yoke) | Klik + geser / M |
| Gas / throttle | Shift / Ctrl / scroll |
| Rudder | Q / E |
| Kamera (chase/kokpit/orbit) | C atau V |
| Roda pendaratan / flaps | G / F |
| Rem udara | B atau Spasi |
| Jeda | P |
| Suara on/off | N |

## Cara main

```sh
node serve.ts
# buka http://localhost:8080 di browser desktop
```

## Struktur

- `game/` — game lengkap (index.html, css/style.css, js/math.js, js/audio.js, js/terrain.js, js/meshes.js, js/renderer.js, js/flight.js, js/hud.js, js/main.js)
- `screenshots/` — 4 screenshot asli dari game yang sedang berjalan
- `main.ts` — program entry: menyalin game/ dan screenshots/ ke /output dan menulis dossier.json
- `vendor/makefun-game.ts` — pustaka kit make.fun (tidak diubah)
- `serve.ts` — server lokal untuk memainkan game/
