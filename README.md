# LocalMachX4 — MachUp-Style Aircraft Design GUI

A local, browser-based MachUp-style 3D aircraft design interface powered by the open-source **MachUpX** (`v2.7.2`) generalized numerical lifting-line solver (USU AeroLab, MIT License).

## Features
- **Interactive 3D Viewport** (Three.js r163, bundled locally for offline use):
  - Ground grid, body-fixed axes (`+X` forward, `+Y` right, `+Z` down), CG (red) & Aerodynamic Center (cyan) markers
  - `OrbitControls` + `TransformControls` (Translate `T`, Rotate `R`, Scale `S`) with optional Grid Snap
  - Live 3D control-surface deflection visualization
- **MachUp-Style Inspector Sidebar**:
  - `COMPONENT TREE` with `Connect To` hierarchy (`Wing`, `Group`, cosmetic `Box` / `Cylinder` / `Sphere`)
  - `OBJECT`, `GEOMETRY` (root/tip airfoils, twist/washout, sweep, dihedral, spanwise segments, control surfaces), `MATERIAL`, `CONDITION`, and `ANALYSIS`
  - Autosave to `localStorage`, Save/Open project JSON, Export MachUpX `aircraft.json` + `scene.json`, Export STL via MachUpX
- **Real MachUpX Solver Backend** (FastAPI + subprocess-isolated runner):
  - Forces & Moments (dimensional & non-dimensional), Pitch Trim, Stability/Damping/Control Derivatives, Aerodynamic Center, and Spanwise Distributions with SVG plots

## Ubuntu Installation & Run

```bash
# Fastest: one-command launcher (starts server + opens browser)
./run.sh

# Or manually:
source .venv/bin/activate
MPLCONFIGDIR=/tmp/mpl uvicorn server.app:app --host 127.0.0.1 --port 8000
```

Then open **http://127.0.0.1:8000** in your browser.

### Fresh Virtual Environment Setup (if needed)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install numpy scipy matplotlib pytest numpy-stl fastapi uvicorn httpx
pip install ./vendor/AirfoilDatabase
pip install ./vendor/MachUpX
```

## Running Tests
```bash
MPLCONFIGDIR=/tmp/mpl .venv/bin/python -m pytest tests/test_backend.py -v
```

## Documentation
- [docs/axes.md](file:///home/user117/Documents/machup4/docs/axes.md) — Verified MachUpX body/earth coordinate conventions and Three.js mapping
- [docs/ui-spec.md](file:///home/user117/Documents/machup4/docs/ui-spec.md) — UI specification derived from the 150 reference frames
- [docs/known-limitations.md](file:///home/user117/Documents/machup4/docs/known-limitations.md) — Known limitations and deviations
