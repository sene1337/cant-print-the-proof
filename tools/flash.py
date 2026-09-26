#!/usr/bin/env python3
"""Flash check for the rendered film (photosensitive-seizure safety), modelled on WCAG 2.x / Ofcom (Harding) rules.

A transition is a change in relative luminance of at least 0.1 (of max) where the darker side is below 0.8.
A flash is a pair of opposing transitions. More than three flashes in any one-second window fails.
Reported per window:
  screen   share of the whole frame that flashes too often (Ofcom/Harding fail at >= 25%)
  field    worst share inside any one-ninth-of-the-screen window (WCAG's 10-degree field; fail at >= 25%)
Red flashes: a change of more than 20 in (R-G-B)x320 (negatives set to zero) involving a saturated red
(R/(R+G+B) >= 0.8) at one end, counted the same way (WCAG 2.x definition).

usage: python3 tools/flash.py out/film-1920x1080-master.mp4 [--from 0 --to 184.03] [--offset 0] [--map t1,t2]
  --offset  add this to every reported time (use the section start when checking a section-only render)
  --map     write out/flash/<kind>_<t>.png: the frame at song time t with the cells that flash too often in red
"""
import subprocess
import sys

import numpy as np

W, H, FPS = 96, 54, 30


def arg(k, d):
    return float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d


def main():
    src = sys.argv[1]
    t0, t1 = arg('--from', 0.0), arg('--to', 1e9)
    off = arg('--offset', 0.0)
    maps = [float(x) for x in sys.argv[sys.argv.index('--map') + 1].split(',')] if '--map' in sys.argv else []
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(t0), '-i', src]
    if t1 < 1e9:
        cmd += ['-t', str(t1 - t0)]
    cmd += ['-vf', f'scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    # Stream the small frames in batches so memory stays low (the whole film is about 100 MB of luminance).
    lut = np.array([c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in np.arange(256) / 255.0], np.float32)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    frame_bytes, lums, reds, sats, keep = W * H * 3, [], [], [], []
    while True:
        chunk = proc.stdout.read(frame_bytes * 256)
        if not chunk:
            break
        k = len(chunk) // frame_bytes
        px = np.frombuffer(chunk[: k * frame_bytes], np.uint8).reshape(k, H * W, 3)
        lin = lut[px]
        lums.append(lin @ np.array([0.2126, 0.7152, 0.0722], np.float32))
        s = lin.sum(axis=2) + 1e-6
        # red value (R-G-B)x320 with negatives set to zero, and whether the pixel is a saturated red (R/(R+G+B) >= 0.8)
        reds.append(np.maximum(0.0, (lin[:, :, 0] - lin[:, :, 1] - lin[:, :, 2]) * 320.0).astype(np.float32))
        sats.append(lin[:, :, 0] / s >= 0.8)
        if maps:
            keep.append(px.copy())
    proc.wait()
    lum, red, sat = np.concatenate(lums), np.concatenate(reds), np.concatenate(sats)
    n = len(lum)
    rgb = np.concatenate(keep).astype(np.float32) / 255.0 if maps else None

    def transitions(y, step, dark_limit):
        cells = y.shape[1]
        ev = np.zeros(y.shape, bool)
        mx = y[0].copy(); mn = y[0].copy(); d = np.zeros(cells, np.int8)
        for f in range(1, len(y)):
            v = y[f]
            up = (v - mn >= step) & (mn < dark_limit) & (d <= 0)
            down = (mx - v >= step) & (v < dark_limit) & (d >= 0) & ~up
            hit = up | down
            ev[f] = hit
            d = np.where(up, 1, np.where(down, -1, d)).astype(np.int8)
            mx = np.where(hit, v, np.maximum(mx, v))
            mn = np.where(hit, v, np.minimum(mn, v))
        return ev

    def dump(bad, name):
        # For each requested time: the frame with cells that flash too often tinted red, side by side with the count.
        import os
        from PIL import Image
        os.makedirs('out/flash', exist_ok=True)
        for tm in maps:
            f = int(round((tm - off - t0) * FPS))
            if not 0 <= f < len(bad):
                continue
            img = (rgb[f].reshape(H, W, 3) * 255).astype(np.uint8)
            m = bad[f].reshape(H, W)
            over = img.copy()
            over[m] = (0.4 * img[m] + np.array([153, 0, 0])).astype(np.uint8)
            Image.fromarray(over).resize((W * 6, H * 6), Image.NEAREST).save(f'out/flash/{name}_{tm:.2f}.png')

    def red_transitions(v, sat, step=20.0):
        # WCAG red flash: a change of more than 20 in (R-G-B)x320 that involves a saturated red at one end or the other
        ev = np.zeros(v.shape, bool)
        mx = v[0].copy(); mn = v[0].copy(); smx = sat[0].copy(); smn = sat[0].copy(); d = np.zeros(v.shape[1], np.int8)
        for f in range(1, len(v)):
            x, sf = v[f], sat[f]
            up = (x - mn >= step) & (d <= 0) & (sf | smn)
            down = (mx - x >= step) & (d >= 0) & ~up & (sf | smx)
            hit = up | down
            ev[f] = hit
            d = np.where(up, 1, np.where(down, -1, d)).astype(np.int8)
            newmx = hit | (x > mx); newmn = hit | (x < mn)
            mx = np.where(newmx, x, mx); smx = np.where(newmx, sf, smx)
            mn = np.where(newmn, x, mn); smn = np.where(newmn, sf, smn)
        return ev

    def report(ev, name):
        cum = np.cumsum(ev, axis=0)
        win = np.zeros_like(cum)
        win[FPS:] = cum[FPS:] - cum[:-FPS]
        win[:FPS] = cum[:FPS]
        bad = win >= 7  # more than three flashes (pairs of transitions) in one second
        if maps:
            dump(bad, name.split()[0])
        screen = bad.mean(axis=1)
        grid = bad.reshape(len(bad), H, W)
        # worst one-ninth-of-screen window, sampled on a coarse grid of positions
        fw, fh = W // 3, H // 3
        field = np.zeros(len(bad))
        for y0 in range(0, H - fh + 1, fh // 3):
            for x0 in range(0, W - fw + 1, fw // 3):
                field = np.maximum(field, grid[:, y0:y0 + fh, x0:x0 + fw].mean(axis=(1, 2)))
        spans = []
        for label, series in (('screen', screen), ('field', field)):
            fail = series >= 0.25
            f = 0
            while f < len(fail):
                if fail[f]:
                    g = f
                    while g + 1 < len(fail) and fail[g + 1]:
                        g += 1
                    # window ending at frame f covers [f - 1 s, f]
                    spans.append((label, off + t0 + max(0, f - FPS + 1) / FPS, off + t0 + g / FPS, float(series[f:g + 1].max())))
                    f = g + 1
                else:
                    f += 1
        print(f'{name}: worst screen {screen.max():.0%} at {off + t0 + screen.argmax() / FPS:.2f} s, worst field {field.max():.0%} at {off + t0 + field.argmax() / FPS:.2f} s')
        for label, a, b, peak in spans:
            print(f'  FAIL {label:6s} {a:7.2f}-{b:7.2f} s  peak {peak:.0%}')
        return spans

    print(f'{n} frames, {n / FPS:.2f} s from {off + t0:.2f} s')
    a = report(transitions(lum, 0.1, 0.8), 'general flash')
    b = report(red_transitions(red, sat), 'red flash')
    sys.exit(1 if (a or b) else 0)


main()
